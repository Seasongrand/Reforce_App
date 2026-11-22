import { ActionForm } from '@/components/ActionForm';
import { reviewQueue, verificationFileLinks } from '@/domain/staff/review';
import { KIND_LABEL } from '@/domain/teachers/verification';
import { appDeps, now } from '@/server/app';
import { requireStaff } from '@/server/session';
import { approveTeacherAction, decidePhotoAction, decideVerificationAction, setTeacherStatusAction } from '../../actions';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, string> = { pending: 'Aguardando', approved: 'Aprovado', rejected: 'Recusado', expired: 'Vencido' };
const TEACHER_STATUS: Record<string, string> = {
  draft: 'cadastro incompleto', in_review: 'em análise', approved: 'aprovado', paused: 'pausado', suspended: 'suspenso',
};
const ACCOUNT: Record<string, string> = { pending: 'em análise no provedor', active: 'ativa', rejected: 'recusada' };
const CARD = 'rounded-[20px] border border-site-line bg-white p-5';

export default async function VerificationQueue() {
  await requireStaff();
  const deps = appDeps();
  const at = await now();
  const queue = await reviewQueue(deps);
  const links = new Map<string, Array<{ name: string; url: string }>>();
  for (const t of queue) for (const v of t.verifications) links.set(v.id, await verificationFileLinks(deps, v.id, at));
  return (
    <div className="space-y-6">
      <h1 className="font-display tracking-tight text-3xl font-normal">Verificações</h1>
      {queue.length === 0 && <p className={`${CARD} text-site-muted`}>Nada aguardando análise.</p>}
      {queue.map((t) => (
        <section key={t.teacherId} className={`${CARD} space-y-4`} data-testid={`fila-${t.slug}`}>
          <div>
            <h2 className="font-display tracking-tight text-xl font-normal">{t.name}</h2>
            <p className="text-sm text-site-muted [overflow-wrap:anywhere]">
              {t.email} · /p/{t.slug} · situação: {TEACHER_STATUS[t.status] ?? t.status} · conta de recebimento: {ACCOUNT[t.paymentAccount ?? ''] ?? 'não aberta'}
            </p>
          </div>
          {t.photo ? (
            <div className="space-y-2 border-t border-site-line pt-3" data-testid="foto">
              <p className="font-medium">Foto: {t.photo.status === 'pending' ? 'Em análise' : 'Aprovada'}</p>
              <div className="flex items-start gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.photo.dataUrl} alt={`Foto enviada por ${t.name}`} width={120} height={120} className="rounded-lg" />
                <p className="text-sm text-site-muted">Compare com o documento de identidade abaixo: precisa ser a mesma pessoa, com o rosto visível.</p>
              </div>
              {t.photo.status === 'pending' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <ActionForm action={decidePhotoAction} submitLabel="Aprovar foto" className="space-y-2">
                    <input type="hidden" name="photoId" value={t.photo.id} />
                    <input type="hidden" name="decision" value="approved" />
                  </ActionForm>
                  <ActionForm action={decidePhotoAction} submitLabel="Recusar foto" className="space-y-2">
                    <input type="hidden" name="photoId" value={t.photo.id} />
                    <input type="hidden" name="decision" value="rejected" />
                    <input name="note" className="input" required placeholder="Motivo (vai para o professor)" aria-label="Motivo da recusa da foto" />
                  </ActionForm>
                </div>
              )}
            </div>
          ) : (
            <p className="border-t border-site-line pt-3 text-sm text-site-muted" data-testid="foto">Foto: ainda não enviada.</p>
          )}
          {t.verifications.map((v) => (
            <div key={v.id} className="space-y-2 border-t border-site-line pt-3" data-testid={`doc-${v.kind}`}>
              <p className="font-medium capitalize">{KIND_LABEL[v.kind]}: {STATUS[v.status] ?? v.status}
                {v.validUntil && <span className="font-normal text-site-muted"> · válido até {v.validUntil}</span>}</p>
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
            <div className="flex gap-3 border-t border-site-line pt-3">
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
