import { ActionForm } from '@/components/ActionForm';
import { teacherEarnings, type EarningItem } from '@/domain/teachers/earnings';
import { formatBRL } from '@/lib/money';
import { formatDatePtBr, formatTime } from '@/time/zoned';
import { appDeps, now } from '@/server/app';
import { requireTeacher } from '@/server/session';
import type { Temporal } from 'temporal-polyfill';
import { openAccountAction } from '../actions';

export const dynamic = 'force-dynamic';

const CARD = 'rounded-3xl border border-site-line bg-white p-5';

const field = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
  <div>
    <label className="label" htmlFor={name}>{label}</label>
    <input className="input" id={name} name={name} required {...props} />
  </div>
);

const day = (i: Temporal.Instant, tz: string) => formatDatePtBr(i.toZonedDateTimeISO(tz).toPlainDate());
const pct = (bps: number) => `${(bps / 100).toLocaleString('pt-BR')}%`;

/** A situação do repasse de uma aula, em palavras. */
function payoutState(i: EarningItem, tz: string, at: Temporal.Instant): { label: string; tone: string } {
  switch (i.status) {
    case 'released':
      return { label: `Liberado${i.releasedAt ? ` em ${day(i.releasedAt, tz)}` : ''}`, tone: 'bg-emerald-50 text-emerald-900' };
    case 'refunded':
      return { label: 'Devolvido ao aluno (falta justificada)', tone: 'bg-slate-100 text-slate-700' };
    case 'releasing':
      return { label: 'A receber · liberação em andamento', tone: 'bg-amber-50 text-amber-900' };
    default:
      return {
        label: i.releaseAfter.epochMilliseconds > at.epochMilliseconds
          ? `A receber · liberação a partir de ${day(i.releaseAfter, tz)}`
          : 'A receber · liberação em andamento',
        tone: 'bg-amber-50 text-amber-900',
      };
  }
}

function Total({ label, cents, note, testId }: { label: string; cents: number; note?: string; testId: string }) {
  return (
    <div className={CARD} data-testid={testId}>
      <p className="text-sm font-semibold text-site-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{formatBRL(cents)}</p>
      {note && <p className="mt-1 text-sm text-site-muted">{note}</p>}
    </div>
  );
}

/** Recebimento: o que o professor tem a receber e já recebeu, aula por aula, e a conta onde o dinheiro cai. */
export default async function PayoutAccountPage() {
  const teacherId = await requireTeacher();
  const { db } = appDeps();
  const at = await now();
  const acc = await db.selectFrom('teacher_payment_accounts').select(['status', 'created_at'])
    .where('teacher_id', '=', teacherId).executeTakeFirst();
  const tz = (await db.selectFrom('teachers').select('timezone').where('id', '=', teacherId).executeTakeFirstOrThrow()).timezone;
  const e = await teacherEarnings(db, teacherId, at);
  const hasAccount = acc !== undefined && acc.status !== 'rejected';
  const showEarnings = hasAccount || e.items.length > 0;

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="font-display text-3xl font-bold">Recebimento</h1>
        <p className="text-site-muted">
          O aluno paga na plataforma. Sua parte fica retida no provedor de pagamento e é liberada na sua conta
          24 horas depois da aula, se ninguém contestar; no cartão, quando a operadora repassa o valor, em cerca de 30 dias.
        </p>
      </div>

      {showEarnings && (
        <section className="space-y-4" aria-labelledby="meus-ganhos">
          <h2 id="meus-ganhos" className="font-display text-xl font-bold">Meus ganhos</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Total label="A receber" cents={e.pendingCents} testId="ganho-a-receber"
              note={e.pendingCount === 0 ? 'Nada aguardando liberação.' : `${e.pendingCount} ${e.pendingCount === 1 ? 'aula aguardando' : 'aulas aguardando'} liberação.`} />
            <Total label="Liberado este mês" cents={e.releasedMonthCents} testId="ganho-mes" />
            <Total label="Liberado no total" cents={e.releasedTotalCents} testId="ganho-total" />
          </div>

          <div className={CARD}>
            <h3 className="mb-3 font-display text-lg font-bold">Por aula</h3>
            {e.items.length === 0 ? (
              <p className="text-sm text-site-muted">Quando você der a primeira aula, o valor dela aparece aqui.</p>
            ) : (
              <ul className="divide-y divide-site-line">
                {e.items.map((i) => {
                  const state = payoutState(i, tz, at);
                  return (
                    <li key={i.bookingId} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0" data-testid={`repasse-${i.bookingId}`}>
                      <div className="min-w-0">
                        <p className="font-semibold">{day(i.startsAt, tz)}, {formatTime(i.startsAt, tz)} · {i.subject} · {i.studentFirstName}</p>
                        <p className="text-sm text-site-muted">
                          Aula {formatBRL(i.grossCents)} · Reforce {pct(i.commissionBps)} · você recebe{' '}
                          <strong className={i.status === 'refunded' ? 'line-through' : 'text-slate-900'}>{formatBRL(i.teacherCents)}</strong>
                        </p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${state.tone}`}>{state.label}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      )}

      {hasAccount ? (
        acc.status === 'active' ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm font-semibold text-emerald-900" data-testid="conta-status">
            <span aria-hidden="true">✓ </span>Conta de recebimento ativa. Os repasses caem nela.
          </p>
        ) : (
          <p className="notice" data-testid="conta-status">Conta de recebimento em análise no provedor.</p>
        )
      ) : (
        <section className={CARD} aria-labelledby="abrir-conta">
          <h2 id="abrir-conta" className="mb-1 font-display text-xl font-bold">Abrir conta de recebimento</h2>
          <p className="mb-4 text-sm text-site-muted">Seus dados vão direto ao provedor de pagamento; a Reforce não guarda seu CPF.</p>
          <ActionForm action={openAccountAction} submitLabel="Abrir conta" successMessage="Conta aberta.">
            {field('name', 'Nome completo do titular')}
            {field('cpfCnpj', 'CPF ou CNPJ', { inputMode: 'numeric' })}
            {field('birthDate', 'Data de nascimento', { type: 'date' })}
            {field('email', 'E-mail', { type: 'email' })}
            {field('phone', 'Celular')}
            <div className="grid gap-4 sm:grid-cols-3">
              {field('postalCode', 'CEP', { inputMode: 'numeric' })}
              {field('address', 'Endereço')}
              {field('addressNumber', 'Número')}
            </div>
            <div>
              <label className="label" htmlFor="province">Bairro</label>
              <input className="input" id="province" name="province" />
            </div>
            {field('income', 'Renda mensal aproximada (R$)', { inputMode: 'decimal' })}
          </ActionForm>
        </section>
      )}
    </div>
  );
}
