/**
 * Meus dados: o responsável muda o nome, liga e desliga os avisos por
 * WhatsApp e troca o e-mail com um código enviado ao e-mail novo.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { finishEmailChange, guardianProfile, startEmailChange, updateGuardianProfile } from '@/domain/guardians/profile';
import { appDb, closeAppDb } from '../helpers/app';
import { closeTestPool, testPool, truncateAll } from '../helpers/db';
import { insertGuardian } from '../helpers/fixtures';
import { NOW, testDeps } from '../helpers/scenario';

beforeEach(truncateAll);
afterAll(async () => {
  await closeAppDb();
  await closeTestPool();
});

const q = async (text: string, params: unknown[] = []) => (await testPool().query(text, params)).rows;
async function lastCode(email: string): Promise<string> {
  const rows = await q(`SELECT body FROM dev_outbox WHERE recipient = $1 ORDER BY id DESC LIMIT 1`, [email]);
  const m = /\b(\d{6})\b/.exec(rows[0]?.body ?? '');
  if (!m) throw new Error(`nenhum código para ${email}`);
  return m[1]!;
}
async function guardian(name: string, phone: string, email: string | null) {
  const id = await insertGuardian(testPool(), { name, phone_e164: phone });
  await q(`UPDATE guardians SET email = $2 WHERE id = $1`, [id, email]);
  return id;
}

describe('meus dados', () => {
  it('lê nome, e-mail, WhatsApp e avisos', async () => {
    const g = await guardian('Maria Lima', '+5511988881111', 'maria@exemplo.com');
    expect(await guardianProfile(appDb(), g)).toEqual({
      name: 'Maria Lima', email: 'maria@exemplo.com', phone: '+5511988881111', whatsappOptIn: false,
    });
  });

  it('muda o nome e os avisos; ligar de novo mantém a data da primeira autorização', async () => {
    const g = await guardian('Maria', '+5511988881111', 'maria@exemplo.com');
    await updateGuardianProfile(appDb(), g, { name: '  Maria Lima ', whatsappOptIn: true }, NOW);
    expect(await q(`SELECT name, whatsapp_opt_in_at FROM guardians`)).toEqual([
      { name: 'Maria Lima', whatsapp_opt_in_at: new Date(NOW.epochMilliseconds) },
    ]);
    await updateGuardianProfile(appDb(), g, { name: 'Maria Lima', whatsappOptIn: true }, NOW.add({ hours: 5 }));
    expect((await q(`SELECT whatsapp_opt_in_at FROM guardians`))[0]!.whatsapp_opt_in_at).toEqual(new Date(NOW.epochMilliseconds));
    await updateGuardianProfile(appDb(), g, { name: 'Maria Lima', whatsappOptIn: false }, NOW);
    expect((await q(`SELECT whatsapp_opt_in_at FROM guardians`))[0]!.whatsapp_opt_in_at).toBeNull();
    await expect(updateGuardianProfile(appDb(), g, { name: 'M', whatsappOptIn: false }, NOW)).rejects.toThrow('informe seu nome');
    await expect(updateGuardianProfile(appDb(), g, { name: 'M'.repeat(81), whatsappOptIn: false }, NOW)).rejects.toThrow('informe seu nome');
  });

  it('troca o e-mail com o código enviado ao e-mail novo', async () => {
    const g = await guardian('Maria', '+5511988881111', 'maria@exemplo.com');
    const s = await startEmailChange(testDeps(), g, ' Maria.Nova@Exemplo.com ', NOW);
    expect(s.sentTo).toBe('m*********@exemplo.com');
    expect((await guardianProfile(appDb(), g)).email).toBe('maria@exemplo.com'); // só muda depois do código
    expect(await finishEmailChange(testDeps(), g, { codeId: s.codeId, code: await lastCode('maria.nova@exemplo.com') }, NOW)).toEqual({ ok: true });
    expect((await guardianProfile(appDb(), g)).email).toBe('maria.nova@exemplo.com');
  });

  it('recusa o mesmo e-mail e o e-mail de outra conta', async () => {
    const g = await guardian('Maria', '+5511988881111', 'maria@exemplo.com');
    await guardian('Outra', '+5511977770000', 'outra@exemplo.com');
    await expect(startEmailChange(testDeps(), g, 'MARIA@exemplo.com', NOW)).rejects.toThrow('este já é o seu e-mail');
    await expect(startEmailChange(testDeps(), g, 'outra@exemplo.com', NOW)).rejects.toThrow('este e-mail já está em outra conta');
  });

  it('o código só vale para a conta que pediu', async () => {
    const a = await guardian('Maria', '+5511988881111', 'maria@exemplo.com');
    const b = await guardian('Outra', '+5511977770000', 'outra@exemplo.com');
    const s = await startEmailChange(testDeps(), a, 'nova@exemplo.com', NOW);
    expect(await finishEmailChange(testDeps(), b, { codeId: s.codeId, code: await lastCode('nova@exemplo.com') }, NOW))
      .toEqual({ ok: false, reason: 'invalido' });
    expect(await q(`SELECT email FROM guardians ORDER BY name`)).toEqual([{ email: 'maria@exemplo.com' }, { email: 'outra@exemplo.com' }]);
  });
});
