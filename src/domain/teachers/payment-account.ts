/**
 * Conta de recebimento do professor no provedor de pagamento (§1, professor,
 * passo 4; §3.4). CPF, nascimento e endereço vão direto ao provedor; a
 * plataforma guarda só os identificadores da conta.
 */
import { sql } from 'kysely';
import { Temporal } from 'temporal-polyfill';
import type { RecipientAccountInput } from '@/providers/payment/types';
import { onlyDigits } from '@/providers/geocoding/fake';
import type { Deps } from '../deps';
import { DomainError } from '../errors';
import { normalizeEmail } from '../auth/codes';
import { normalizePhoneBR } from '../guardians/identify';

function cpfOk(d: string): boolean {
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

function cnpjOk(d: string): boolean {
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const dv = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, w, i) => acc + w * Number(d[i]), 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(12) === Number(d[12]) && dv(13) === Number(d[13]);
}

export function isValidCpfCnpj(v: string): boolean {
  const d = onlyDigits(v);
  return d.length === 11 ? cpfOk(d) : cnpjOk(d);
}

export type PaymentAccountInput = Omit<RecipientAccountInput, 'teacherId'>;

export async function openPaymentAccount(
  deps: Deps,
  teacherId: string,
  input: PaymentAccountInput,
  now: Temporal.Instant,
): Promise<{ status: string }> {
  if (!isValidCpfCnpj(input.cpfCnpj)) throw new DomainError('invalid', 'CPF ou CNPJ inválido');
  if (input.name.trim().length < 3) throw new DomainError('invalid', 'informe o nome completo do titular');
  let birth: Temporal.PlainDate;
  try {
    birth = Temporal.PlainDate.from(input.birthDate);
  } catch {
    throw new DomainError('invalid', 'data de nascimento inválida');
  }
  const today = now.toZonedDateTimeISO('America/Sao_Paulo').toPlainDate();
  if (Temporal.PlainDate.compare(birth.add({ years: 18 }), today) > 0) {
    throw new DomainError('invalid', 'o titular da conta precisa ter 18 anos ou mais');
  }
  const postalCode = onlyDigits(input.postalCode);
  if (postalCode.length !== 8) throw new DomainError('invalid', 'CEP inválido');
  if (!input.address.trim() || !input.addressNumber.trim()) throw new DomainError('invalid', 'informe endereço e número');
  if (!(input.incomeValueCents > 0)) throw new DomainError('invalid', 'informe a renda mensal');

  const existing = await deps.db.selectFrom('teacher_payment_accounts').select('status')
    .where('teacher_id', '=', teacherId).executeTakeFirst();
  if (existing && existing.status !== 'rejected') throw new DomainError('conflict', 'este professor já tem conta de recebimento');

  const acc = await deps.providers.payment.createRecipientAccount({
    teacherId,
    name: input.name.trim(),
    email: normalizeEmail(input.email),
    cpfCnpj: onlyDigits(input.cpfCnpj),
    birthDate: birth.toString(),
    phone: normalizePhoneBR(input.phone),
    postalCode,
    address: input.address.trim(),
    addressNumber: input.addressNumber.trim(),
    province: input.province?.trim(),
    incomeValueCents: input.incomeValueCents,
  });
  await sql`INSERT INTO teacher_payment_accounts (teacher_id, provider, provider_account_id, wallet_id, status)
            VALUES (${teacherId}, ${deps.providers.payment.name}, ${acc.accountId}, ${acc.walletId}, ${acc.status})
            ON CONFLICT (teacher_id) DO UPDATE
               SET provider = EXCLUDED.provider, provider_account_id = EXCLUDED.provider_account_id,
                   wallet_id = EXCLUDED.wallet_id, status = EXCLUDED.status`.execute(deps.db);
  return { status: acc.status };
}
