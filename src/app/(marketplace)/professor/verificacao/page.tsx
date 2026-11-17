import Link from 'next/link';
import { ActionForm } from '@/components/ActionForm';
import { KIND_LABEL, listVerifications, VERIFICATION_KINDS } from '@/domain/teachers/verification';
import { appDeps } from '@/server/app';
import { requireTeacher } from '@/server/session';
import { uploadDocumentAction } from '../actions';

export const dynamic = 'force-dynamic';

const HELP: Record<string, string> = {
  identity: 'Documento com foto (RG ou CNH) e uma selfie segurando o documento.',
  criminal_record: 'Certidão de antecedentes criminais da Polícia Federal, emitida de graça em gov.br.',
  education: 'Diploma, histórico ou declaração de matrícula.',
};
const STATUS: Record<string, string> = {
  pending: 'Em análise', approved: 'Aprovado', rejected: 'Recusado', expired: 'Vencido',
};

export default async function VerificationPage() {
  const teacherId = await requireTeacher();
  const all = await listVerifications(appDeps(), teacherId);
  return (
    <div className="space-y-6">
      <Link href="/professor" className="text-sm text-brand">← Painel</Link>
      <h1 className="text-2xl font-semibold">Documentos de verificação</h1>
      <p className="text-sm text-slate-700">
        Os arquivos ficam guardados cifrados e só a equipe de análise os abre, por link temporário.
      </p>
      {VERIFICATION_KINDS.map((kind) => {
        const latest = all.find((v) => v.kind === kind);
        const canSend = !latest || latest.status === 'rejected' || latest.status === 'expired';
        return (
          <section key={kind} className="card space-y-3" data-testid={`verificacao-${kind}`}>
            <h2 className="font-medium capitalize">{KIND_LABEL[kind]}</h2>
            <p className="text-sm text-slate-600">{HELP[kind]}</p>
            {latest && (
              <p className="text-sm">
                Situação: <strong>{STATUS[latest.status] ?? latest.status}</strong>
                {latest.validUntil && ` · válido até ${latest.validUntil.split('-').reverse().join('/')}`}
                {latest.decisionNote && <span className="block text-slate-600">Motivo: {latest.decisionNote}</span>}
              </p>
            )}
            {canSend && (
              <ActionForm action={uploadDocumentAction} submitLabel="Enviar" successMessage="Enviado para análise."
                className="space-y-3">
                <input type="hidden" name="kind" value={kind} />
                <input type="file" name="files" multiple={kind === 'identity'} required
                  accept="application/pdf,image/jpeg,image/png,image/webp" aria-label={`Arquivos de ${KIND_LABEL[kind]}`} />
                {kind === 'identity' && <p className="text-xs text-slate-500">Selecione os dois arquivos juntos.</p>}
              </ActionForm>
            )}
          </section>
        );
      })}
    </div>
  );
}
