/**
 * Criar conta sem comprar: o adulto responsável se cadastra com nome, e-mail
 * e WhatsApp (e, se quiser, o primeiro aluno), confirmando o e-mail por
 * código. Nunca cria uma segunda conta para o mesmo WhatsApp ou e-mail.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getSession } from '@/domain/auth/sessions';
import { finishGuardianSignup, startGuardianSignup } from '@/domain/guardians/signup';
import { appDb, closeAppDb } from '../helpers/app';
import { closeTestPool, testPool, truncateAll } from '../helpers/db';
import { insertGuardian } from '../helpers/fixtures';
import { NOW, testDeps } from '../helpers/scenario';

beforeEach(truncateAll);
afterAll(async () => {
  await closeAppDb();
  await closeTestPool();
});

const deps = () => testDeps();
const q = async (text: string, params: unknown[] = []) => (await testPool().query(text, params)).rows;
async function lastCode(email: string): Promise<string> {
  const rows = await q(`SELECT body FROM dev_outbox WHERE recipient = $1 ORDER BY id DESC LIMIT 1`, [email]);
  const m = /\b(\d{6})\b/.exec(rows[0]?.body ?? '');
  if (!m) throw new Error(`nenhum código para ${email}`);
  return m[1]!;
}
const base = { name: 'Maria Lima', email: 'maria@exemplo.com', phone: '(11) 98888-1111', whatsappOptIn: false, timezone: 'America/Sao_Paulo' };

async function signUp(input: Partial<typeof base> & { studentFirstName?: string; studentGrade?: string }, sentToEmail?: string) {
  const s = await startGuardianSignup(deps(), { ...base, ...input }, NOW);
  return finishGuardianSignup(deps(), { codeId: s.codeId, code: await lastCode(sentToEmail ?? input.email ?? base.email) }, NOW);
}

describe('criar conta', () => {
  it('conta nova sem aluno: cria o responsável e abre a sessão', async () => {
    const s = await startGuardianSignup(deps(), base, NOW);
    expect(s.sentTo).toBe('m****@exemplo.com');
    const r = await finishGuardianSignup(deps(), { codeId: s.codeId, code: await lastCode('maria@exemplo.com') }, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(await q(`SELECT name, email, phone_e164, whatsapp_opt_in_at FROM guardians`)).toEqual([
      { name: 'Maria Lima', email: 'maria@exemplo.com', phone_e164: '+5511988881111', whatsapp_opt_in_at: null },
    ]);
    expect(await q(`SELECT count(*)::int AS n FROM students`)).toEqual([{ n: 0 }]);
    expect(await getSession(appDb(), r.token, NOW)).toEqual({ subjectType: 'guardian', subjectId: r.guardianId });
  });

  it('com o primeiro aluno: guarda só o primeiro nome e a série', async () => {
    const r = await signUp({ studentFirstName: ' Joana Souza ', studentGrade: '9ano', whatsappOptIn: true });
    expect(r.ok).toBe(true);
    expect(await q(`SELECT first_name, grade FROM students`)).toEqual([{ first_name: 'Joana', grade: '9ano' }]);
    expect((await q(`SELECT whatsapp_opt_in_at FROM guardians`))[0]!.whatsapp_opt_in_at).not.toBeNull();
  });

  it('nome do aluno sem série, série inválida ou nome curto do adulto são recusados', async () => {
    await expect(startGuardianSignup(deps(), { ...base, studentFirstName: 'Joana' }, NOW)).rejects.toThrow('escolha a série do aluno');
    await expect(startGuardianSignup(deps(), { ...base, studentFirstName: 'Joana', studentGrade: 'x' }, NOW)).rejects.toThrow('escolha a série do aluno');
    await expect(startGuardianSignup(deps(), { ...base, name: 'M' }, NOW)).rejects.toThrow('informe seu nome');
  });

  it('WhatsApp que já tem conta: o código vai ao e-mail da conta e a pessoa entra nela, sem trocar o e-mail', async () => {
    const existing = await insertGuardian(testPool(), { name: 'Maria', phone_e164: '+5511988881111' });
    await q(`UPDATE guardians SET email = 'antigo@exemplo.com' WHERE id = $1`, [existing]);
    const s = await startGuardianSignup(deps(), { ...base, email: 'novo@exemplo.com' }, NOW);
    expect(s.sentTo).toBe('a*****@exemplo.com');
    expect(await q(`SELECT count(*)::int AS n FROM dev_outbox WHERE recipient = 'novo@exemplo.com'`)).toEqual([{ n: 0 }]);
    const r = await finishGuardianSignup(deps(), { codeId: s.codeId, code: await lastCode('antigo@exemplo.com') }, NOW);
    expect(r).toMatchObject({ ok: true, guardianId: existing });
    expect(await q(`SELECT email FROM guardians`)).toEqual([{ email: 'antigo@exemplo.com' }]);
  });

  it('e-mail que já tem conta (WhatsApp novo): entra na conta do e-mail, sem criar outra', async () => {
    const existing = await insertGuardian(testPool(), { name: 'Maria', phone_e164: '+5521977770000' });
    await q(`UPDATE guardians SET email = 'maria@exemplo.com' WHERE id = $1`, [existing]);
    const r = await signUp({ studentFirstName: 'Pedro', studentGrade: '1serie' });
    expect(r).toMatchObject({ ok: true, guardianId: existing });
    expect(await q(`SELECT count(*)::int AS n FROM guardians`)).toEqual([{ n: 1 }]);
    expect(await q(`SELECT phone_e164 FROM guardians`)).toEqual([{ phone_e164: '+5521977770000' }]);
    expect(await q(`SELECT first_name FROM students WHERE guardian_id = $1`, [existing])).toEqual([{ first_name: 'Pedro' }]);
  });

  it('aluno com o mesmo primeiro nome não duplica: atualiza a série', async () => {
    await signUp({ studentFirstName: 'Joana', studentGrade: '8ano' });
    await signUp({ studentFirstName: 'joana', studentGrade: '9ano' });
    expect(await q(`SELECT first_name, grade FROM students`)).toEqual([{ first_name: 'Joana', grade: '9ano' }]);
  });

  it('código errado não cria nada', async () => {
    const s = await startGuardianSignup(deps(), base, NOW);
    const code = await lastCode('maria@exemplo.com');
    const wrong = code === '000000' ? '111111' : '000000';
    expect(await finishGuardianSignup(deps(), { codeId: s.codeId, code: wrong }, NOW)).toEqual({ ok: false, reason: 'invalido' });
    expect(await q(`SELECT count(*)::int AS n FROM guardians`)).toEqual([{ n: 0 }]);
  });
});
