/**
 * Login sem senha por código (§1 passo 5, §3.5): professor, equipe e
 * responsável no checkout. Aluno não tem login.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { finishTeacherLogin, startTeacherLogin } from '@/domain/auth/teacher';
import { finishStaffLogin, startStaffLogin } from '@/domain/auth/staff';
import { getSession } from '@/domain/auth/sessions';
import { confirmGuardian, identifyGuardian, normalizePhoneBR, saveAddress } from '@/domain/guardians/identify';
import { appDb, closeAppDb } from '../helpers/app';
import { closeTestPool, testPool, truncateAll } from '../helpers/db';
import { NOW, testDeps } from '../helpers/scenario';

beforeEach(truncateAll);
afterAll(async () => {
  await closeAppDb();
  await closeTestPool();
});

const deps = () => testDeps();
const q = async (text: string, params: unknown[] = []) => (await testPool().query(text, params)).rows;

/** Último código enviado para o e-mail. */
async function lastCode(email: string): Promise<string> {
  const rows = await q(`SELECT body FROM dev_outbox WHERE recipient = $1 ORDER BY id DESC LIMIT 1`, [email]);
  const m = /\b(\d{6})\b/.exec(rows[0]?.body ?? '');
  if (!m) throw new Error(`nenhum código para ${email}`);
  return m[1]!;
}

describe('login do professor', () => {
  it('primeiro acesso cria o cadastro em rascunho; o segundo entra no mesmo', async () => {
    const a = await startTeacherLogin(deps(), '  Ana@Exemplo.com ', NOW);
    expect(a.sentTo).toBe('a**@exemplo.com');
    const r = await finishTeacherLogin(deps(), { codeId: a.codeId, code: await lastCode('ana@exemplo.com') }, NOW);
    expect(r).toMatchObject({ ok: true, isNew: true });
    if (!r.ok) return;
    expect(await q(`SELECT email, status FROM teachers WHERE id = $1`, [r.teacherId])).toEqual([
      { email: 'ana@exemplo.com', status: 'draft' },
    ]);
    expect(await getSession(appDb(), r.token, NOW)).toEqual({ subjectType: 'teacher', subjectId: r.teacherId });

    const b = await startTeacherLogin(deps(), 'ana@exemplo.com', NOW.add({ minutes: 1 }));
    const r2 = await finishTeacherLogin(deps(), { codeId: b.codeId, code: await lastCode('ana@exemplo.com') }, NOW.add({ minutes: 1 }));
    expect(r2).toMatchObject({ ok: true, isNew: false });
    if (r2.ok) expect(r2.teacherId).toBe(r.teacherId);
  });

  it('código vencido, já usado ou errado demais é recusado', async () => {
    const a = await startTeacherLogin(deps(), 'ana@exemplo.com', NOW);
    const code = await lastCode('ana@exemplo.com');
    expect(await finishTeacherLogin(deps(), { codeId: a.codeId, code }, NOW.add({ minutes: 11 }))).toEqual({
      ok: false, reason: 'expirado',
    });

    const b = await startTeacherLogin(deps(), 'ana@exemplo.com', NOW);
    const codeB = await lastCode('ana@exemplo.com');
    expect((await finishTeacherLogin(deps(), { codeId: b.codeId, code: codeB }, NOW)).ok).toBe(true);
    expect(await finishTeacherLogin(deps(), { codeId: b.codeId, code: codeB }, NOW)).toEqual({ ok: false, reason: 'invalido' });

    const c = await startTeacherLogin(deps(), 'ana@exemplo.com', NOW);
    const codeC = await lastCode('ana@exemplo.com');
    const wrong = codeC === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) await finishTeacherLogin(deps(), { codeId: c.codeId, code: wrong }, NOW);
    expect(await finishTeacherLogin(deps(), { codeId: c.codeId, code: codeC }, NOW)).toEqual({ ok: false, reason: 'bloqueado' });
  });

  it('limita os pedidos de código por e-mail', async () => {
    for (let i = 0; i < 5; i++) await startTeacherLogin(deps(), 'ana@exemplo.com', NOW.add({ minutes: i }));
    await expect(startTeacherLogin(deps(), 'ana@exemplo.com', NOW.add({ minutes: 6 }))).rejects.toThrow(/muitos códigos/);
    await expect(startTeacherLogin(deps(), 'ana@exemplo.com', NOW.add({ minutes: 61 }))).resolves.toBeTruthy();
  });

  it('e-mail inválido é recusado', async () => {
    await expect(startTeacherLogin(deps(), 'ana-sem-arroba', NOW)).rejects.toThrow(/e-mail/);
  });
});

describe('login da equipe', () => {
  it('só quem está em staff_users recebe código; a resposta é a mesma para os dois', async () => {
    await testPool().query(`INSERT INTO staff_users (email, name) VALUES ('ops@exemplo.com', 'Ops')`);
    const outsider = await startStaffLogin(deps(), 'curioso@exemplo.com', NOW);
    expect(outsider.sentTo).toBe('c******@exemplo.com');
    expect(await q(`SELECT 1 FROM dev_outbox WHERE recipient = 'curioso@exemplo.com'`)).toEqual([]);
    expect(await finishStaffLogin(deps(), { codeId: outsider.codeId, code: '123456' }, NOW)).toEqual({
      ok: false, reason: 'invalido',
    });

    const s = await startStaffLogin(deps(), 'ops@exemplo.com', NOW);
    const r = await finishStaffLogin(deps(), { codeId: s.codeId, code: await lastCode('ops@exemplo.com') }, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) expect((await getSession(appDb(), r.token, NOW))?.subjectType).toBe('staff');
  });
});

describe('sessões', () => {
  it('guardam só o hash do token e vencem', async () => {
    const a = await startTeacherLogin(deps(), 'ana@exemplo.com', NOW);
    const r = await finishTeacherLogin(deps(), { codeId: a.codeId, code: await lastCode('ana@exemplo.com') }, NOW);
    if (!r.ok) throw new Error('esperava login');
    expect(JSON.stringify(await q(`SELECT * FROM sessions`))).not.toContain(r.token);
    expect(await getSession(appDb(), r.token, NOW.add({ hours: 24 * 31 }))).toBeNull();
    expect(await getSession(appDb(), 'token-inventado', NOW)).toBeNull();
  });
});

describe('identificação do responsável no checkout', () => {
  const base = {
    name: 'Maria Lima', email: 'maria@exemplo.com', whatsappOptIn: true, timezone: 'America/Manaus',
    studentFirstName: 'Joana', studentGrade: '9ano',
  };

  it('normaliza o telefone para E.164', () => {
    expect(normalizePhoneBR('(11) 98888-7777')).toBe('+5511988887777');
    expect(normalizePhoneBR('+55 11 988887777')).toBe('+5511988887777');
    expect(() => normalizePhoneBR('123')).toThrow(/telefone/);
  });

  it('formatos diferentes do mesmo telefone dão o mesmo responsável e o mesmo aluno', async () => {
    const a = await identifyGuardian(deps(), { ...base, phone: '(11) 98888-7777' }, NOW);
    const r1 = await confirmGuardian(deps(), { codeId: a.codeId, code: await lastCode('maria@exemplo.com') }, NOW);
    const b = await identifyGuardian(deps(), { ...base, phone: '+55 11 988887777' }, NOW);
    const r2 = await confirmGuardian(deps(), { codeId: b.codeId, code: await lastCode('maria@exemplo.com') }, NOW);
    expect(r1.ok && r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;
    expect(r2.guardianId).toBe(r1.guardianId);
    expect(r2.studentId).toBe(r1.studentId);
    expect(await q(`SELECT phone_e164, timezone, whatsapp_opt_in_at IS NOT NULL AS opt FROM guardians`)).toEqual([
      { phone_e164: '+5511988887777', timezone: 'America/Manaus', opt: true },
    ]);
    expect(await q(`SELECT first_name, grade FROM students`)).toEqual([{ first_name: 'Joana', grade: '9ano' }]);
    expect((await getSession(appDb(), r2.token, NOW))?.subjectType).toBe('guardian');
  });

  it('telefone já cadastrado: o código vai para o e-mail da conta, nunca para um e-mail novo', async () => {
    const a = await identifyGuardian(deps(), { ...base, phone: '(11) 98888-7777' }, NOW);
    await confirmGuardian(deps(), { codeId: a.codeId, code: await lastCode('maria@exemplo.com') }, NOW);

    const intruder = await identifyGuardian(
      deps(), { ...base, name: 'Outra Pessoa', email: 'intruso@exemplo.com', phone: '11988887777' }, NOW.add({ minutes: 1 }),
    );
    expect(intruder.sentTo).toBe('m****@exemplo.com');
    expect(await q(`SELECT 1 FROM dev_outbox WHERE recipient = 'intruso@exemplo.com'`)).toEqual([]);
    const r = await confirmGuardian(
      deps(), { codeId: intruder.codeId, code: await lastCode('maria@exemplo.com') }, NOW.add({ minutes: 1 }),
    );
    expect(r.ok).toBe(true);
    expect(await q(`SELECT name, email FROM guardians`)).toEqual([{ name: 'Maria Lima', email: 'maria@exemplo.com' }]);
  });

  it('sem aceite de WhatsApp, não guarda a data do aceite', async () => {
    const a = await identifyGuardian(deps(), { ...base, whatsappOptIn: false, phone: '11977776666' }, NOW);
    await confirmGuardian(deps(), { codeId: a.codeId, code: await lastCode('maria@exemplo.com') }, NOW);
    expect(await q(`SELECT whatsapp_opt_in_at FROM guardians`)).toEqual([{ whatsapp_opt_in_at: null }]);
  });

  it('endereço da família ganha coordenadas pelo CEP', async () => {
    const a = await identifyGuardian(deps(), { ...base, phone: '11977776666' }, NOW);
    const r = await confirmGuardian(deps(), { codeId: a.codeId, code: await lastCode('maria@exemplo.com') }, NOW);
    if (!r.ok) throw new Error('esperava confirmação');
    const { addressId } = await saveAddress(deps(), r.guardianId, {
      cep: '01310-100', street: 'Av. Paulista', number: '1000', district: 'Bela Vista', city: 'São Paulo', state: 'sp',
    });
    expect(await q(`SELECT cep, state, lat IS NOT NULL AS geo FROM addresses WHERE id = $1`, [addressId])).toEqual([
      { cep: '01310100', state: 'SP', geo: true },
    ]);
  });
});
