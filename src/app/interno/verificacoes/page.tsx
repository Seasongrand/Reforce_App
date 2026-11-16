import Link from 'next/link';
import { ActionForm } from '@/components/ActionForm';
import { reviewQueue, verificationFileLinks } from '@/domain/staff/review';
import { KIND_LABEL } from '@/domain/teachers/verification';
import { appDeps, now } from '@/server/app';
import { requireStaff } from '@/server/session';
import { approveTeacherAction, decideVerificationAction, setTeacherStatusAction } from '../actions';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, string> = { pending: 'Aguardando', approved: 'Aprovado', rejected: 'Recusado', expired: 'Vencido' };

export default async function VerificationQueue() {
  await requireStaff();
  const deps = appDeps();
  const at = await now();
  const queue = await reviewQueue(deps);
  const links = new Map<string, Array<{ name: string; url: string }>>();
  for (const t of queue) for (const v of t.verifications) links.set(v.id, await verificationFileLinks(deps, v.id, at));
  return (
    <div className="space-y-6">
      <Link href="/interno" className="text-sm text-brand">← Painel</Link>
      <h1 className="text-2xl font-semibold">Fila de verificação</h1>
      {queue.length === 0 && <p className="text-slate-600">Nada aguardando análise.</p>}
      {queue.map((t) => (
        <section key={t.teacherId} className="card space-y-4" data-testid={`fila-${t.slug}`}>
          <div>
            <h2 className="text-lg font-medium">{t.name}</h2>
            <p className="text-sm text-slate-600">{t.email} · /p/{t.slug} · situação: {t.status} · conta de recebimento: {t.paymentAccount ?? 'não aberta'}</p>
          </div>
          {t.verifications.map((v) => (
            <div key={v.id} className="space-y-2 border-t border-slate-100 pt-3" data-testid={`doc-${v.kind}`}>
              <p className="font-medium capitalize">{KIND_LABEL[v.kind]}: {STATUS[v.status] ?? v.status}
                {v.validUntil && <span className="font-normal text-slate-600"> · válido até {v.validUntil}</span>}</p>
              <ul className="text-sm">
                {(links.get(v.id) ?? []).map((l) => (
                  <li key={l.url}><a className="text-brand underline" href={l.url} target="_blank" rel="noreferrer">{l.name}</a></li>
                ))}
              </ul>
              {v.status === 'pending' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <ActionForm action={decideVerificationAction} submitLabel="Aprovar" className="space-y-2">
                    <input type="hidden" name="verificationId" value={v.id} />
                    <input type="hidden" name="decision" value="approved" />
                    {v.kind === 'criminal_record' && (
                      <label className="block text-sm">Válida até (vazio: padrão de {deps.config.criminalRecordValidityMonths} meses)
                        <input type="date" name="validUntil" className="input" />
                      </label>
                    )}
                  </ActionForm>
                  <ActionForm action={decideVerificationAction} submitLabel="Recusar" className="space-y-2">
                    <input type="hidden" name="verificationId" value={v.id} />
                    <input type="hidden" name="decision" value="rejected" />
                    <input name="note" className="input" placeholder="Motivo (vai para o professor)" aria-label="Motivo da recusa" />
                  </ActionForm>
                </div>
              )}
            </div>
          ))}
          {t.status === 'in_review' && (
            <div className="flex gap-3 border-t border-slate-100 pt-3">
              <ActionForm action={approveTeacherAction} submitLabel="Aprovar perfil" className="">
                <input type="hidden" name="teacherId" value={t.teacherId} />
              </ActionForm>
              <ActionForm action={setTeacherStatusAction} submitLabel="Suspender" className="">
                <input type="hidden" name="teacherId" value={t.teacherId} />
                <input type="hidden" name="status" value="suspended" />
              </ActionForm>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
