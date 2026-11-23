import Link from 'next/link';
import { PrintButton } from '@/components/panel/PrintButton';
import { STATUS_LABEL, statementMonths, teacherStatement } from '@/domain/teachers/statement';
import { formatBRL } from '@/lib/money';
import { formatTime } from '@/time/zoned';
import { appDeps, now } from '@/server/app';
import { requireTeacher } from '@/server/session';

export const dynamic = 'force-dynamic';

const CARD = 'rounded-[20px] border border-site-line bg-white p-5';
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Extrato do mês: cada aula com o valor, a comissão e o que fica com o professor; a planilha e a impressão. */
export default async function StatementPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const teacherId = await requireTeacher();
  const { db } = appDeps();
  const t = await db.selectFrom('teachers').select('timezone').where('id', '=', teacherId).executeTakeFirstOrThrow();
  const current = (await now()).toZonedDateTimeISO(t.timezone).toPlainDate().toPlainYearMonth().toString();
  const { mes } = await searchParams;
  const month = mes && MONTH_RE.test(mes) ? mes : current;
  const months = await statementMonths(db, teacherId);
  const s = await teacherStatement(db, teacherId, month);
  const options = months.some((m) => m.month === month) ? months : [{ month, label: s.label }, ...months];
  const day = (i: (typeof s.items)[number]) => {
    const z = i.startsAt.toZonedDateTimeISO(s.timezone);
    return `${String(z.day).padStart(2, '0')}/${String(z.month).padStart(2, '0')}`;
  };
  return (
    <div className="space-y-6">
      <div className="space-y-1.5 print:hidden">
        <Link href="/professor/recebimento" className="inline-flex min-h-11 items-center text-sm font-medium text-indigo-600">← Recebimento</Link>
        <h1 className="font-display text-3xl font-normal tracking-tight">Extrato</h1>
        <p className="text-site-muted">As aulas do mês, pela data da aula. Aula devolvida ao aluno aparece na lista, mas não entra na soma.</p>
      </div>
      <form method="get" className="flex flex-wrap items-end gap-2 print:hidden">
        <label className="space-y-1.5 text-sm font-medium">
          Mês
          <select name="mes" defaultValue={month} className="block min-h-11 rounded-lg border border-site-field bg-white px-3 text-[15px] font-normal">
            {options.map((m) => <option key={m.month} value={m.month}>{m.label}</option>)}
          </select>
        </label>
        <button className="inline-flex min-h-11 items-center rounded-lg border border-site-field bg-white px-4 text-sm font-medium hover:bg-violet-50">Ver</button>
        <a href={`/professor/extrato.csv?mes=${month}`} className="inline-flex min-h-11 items-center rounded-lg border border-site-field bg-white px-4 text-sm font-medium hover:bg-violet-50">Baixar planilha</a>
        <PrintButton />
      </form>

      <section className={`${CARD} space-y-4`} aria-labelledby="mes" data-testid="extrato">
        <h2 id="mes" className="font-display text-xl font-normal tracking-tight first-letter:uppercase">{s.label}</h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div><dt className="text-sm text-site-muted">Aulas</dt><dd className="font-display text-xl tracking-tight">{s.totals.lessons}</dd></div>
          <div><dt className="text-sm text-site-muted">Valor das aulas</dt><dd className="font-display text-xl tracking-tight">{formatBRL(s.totals.grossCents)}</dd></div>
          <div><dt className="text-sm text-site-muted">Comissão</dt><dd className="font-display text-xl tracking-tight">{formatBRL(s.totals.platformCents)}</dd></div>
          <div><dt className="text-sm text-site-muted">Você recebe</dt><dd className="font-display text-xl tracking-tight" data-testid="extrato-total">{formatBRL(s.totals.teacherCents)}</dd></div>
        </dl>
        {s.items.length === 0 ? (
          <p className="text-site-muted">Nenhuma aula com repasse neste mês.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-site-muted">
                  <th className="py-2 font-medium">Data</th><th className="py-2 font-medium">Aluno</th><th className="py-2 font-medium">Disciplina</th>
                  <th className="py-2 text-right font-medium">Aula</th><th className="py-2 text-right font-medium">Comissão</th>
                  <th className="py-2 text-right font-medium">Você recebe</th><th className="py-2 pl-4 font-medium">Situação</th>
                </tr>
              </thead>
              <tbody>
                {s.items.map((i) => (
                  <tr key={i.bookingId} className={`border-t border-site-line ${i.status === 'refunded' ? 'text-site-muted line-through decoration-slate-300' : ''}`}>
                    <td className="py-2 tabular-nums">{day(i)} {formatTime(i.startsAt, s.timezone)}</td>
                    <td className="py-2">{i.studentFirstName}</td>
                    <td className="py-2">{i.subject}</td>
                    <td className="py-2 text-right tabular-nums">{formatBRL(i.grossCents)}</td>
                    <td className="py-2 text-right tabular-nums">{formatBRL(i.platformCents)}</td>
                    <td className="py-2 text-right font-medium tabular-nums">{formatBRL(i.teacherCents)}</td>
                    <td className="py-2 pl-4 no-underline">{STATUS_LABEL[i.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
