import Link from 'next/link';
import { ActionForm } from '@/components/ActionForm';
import { subjectName } from '@/domain/catalog';
import { formatBRL } from '@/lib/money';
import { appDeps } from '@/server/app';
import { requireTeacher } from '@/server/session';
import { createServiceAction, updateServiceAction } from '../agenda/actions';

export const dynamic = 'force-dynamic';

const MODALITY: Record<string, string> = {
  online: 'Online', at_teacher: 'No meu endereço', at_student: 'Na casa do aluno',
};

export default async function ServicesPage() {
  const teacherId = await requireTeacher();
  const db = appDeps().db;
  const services = await db.selectFrom('services').selectAll().where('teacher_id', '=', teacherId).orderBy('modality').execute();
  const subjects = await db.selectFrom('teacher_subjects').innerJoin('subjects', 'subjects.id', 'teacher_subjects.subject_id')
    .select(['subjects.id', 'subjects.name']).distinct().where('teacher_id', '=', teacherId).execute();
  const floor = appDeps().config.priceFloorCents;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Serviços</h1>
      <p className="text-sm text-slate-600">
        Você define o preço{floor > 0 ? ` (mínimo da plataforma: ${formatBRL(floor)})` : ''}. Mudanças valem para as próximas
        reservas; aulas já reservadas mantêm o preço e a duração combinados.
      </p>
      <ul className="space-y-2" data-testid="servicos">
        {services.map((s) => (
          <li key={s.id} className="card flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm">
              <strong>{subjectName(s.subject)}</strong> · {MODALITY[s.modality]} · {s.duration_min} min · {formatBRL(s.price_cents)}
              {(s.buffer_before_min > 0 || s.buffer_after_min > 0) && ` · intervalo ${s.buffer_before_min}/${s.buffer_after_min} min`}
              {!s.active && ' · inativo'}
            </span>
            <ActionForm action={updateServiceAction} submitLabel={s.active ? 'Desativar' : 'Ativar'} className="">
              <input type="hidden" name="id" value={s.id} />
              <input type="hidden" name="active" value={String(!s.active)} />
            </ActionForm>
          </li>
        ))}
      </ul>
      <section className="card">
        <h2 className="mb-3 font-medium">Novo serviço</h2>
        {subjects.length === 0 ? (
          <p className="text-sm text-slate-600">Escolha suas disciplinas no <Link className="text-brand underline" href="/professor/cadastro">perfil</Link>.</p>
        ) : (
          <ActionForm action={createServiceAction} submitLabel="Criar serviço" successMessage="Serviço criado." className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Disciplina
              <select name="subjectId" className="input">{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
            <label className="text-sm">Modalidade
              <select name="modality" className="input">
                {Object.entries(MODALITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></label>
            <label className="text-sm">Duração (minutos)
              <input name="durationMin" className="input" inputMode="numeric" defaultValue={60} /></label>
            <label className="text-sm">Preço da aula (R$)
              <input name="price" className="input" inputMode="decimal" required /></label>
            <label className="text-sm">Intervalo antes (min; vazio: 30 no presencial, 0 no online)
              <input name="bufferBeforeMin" className="input" inputMode="numeric" /></label>
            <label className="text-sm">Intervalo depois (min; vazio: 30 no presencial, 0 no online)
              <input name="bufferAfterMin" className="input" inputMode="numeric" /></label>
          </ActionForm>
        )}
      </section>
    </div>
  );
}
