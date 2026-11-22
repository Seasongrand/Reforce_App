import Link from 'next/link';
import { ActionForm } from '@/components/ActionForm';
import { ServiceForm } from '@/components/professor/ServiceForm';
import { subjectName } from '@/domain/catalog';
import { splitCommission } from '@/domain/payouts/split';
import { formatBRL } from '@/lib/money';
import { appDeps } from '@/server/app';
import { requireTeacher } from '@/server/session';
import { createServiceAction, updateServiceAction } from '../agenda/actions';

export const dynamic = 'force-dynamic';

const WHERE: Record<string, string> = {
  online: 'Online', at_teacher: 'No meu endereço', at_student: 'Na casa do aluno',
};
const CARD = 'rounded-[20px] border border-site-line bg-white p-5';
const duration = (m: number) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`);

/** Serviços e preços: um cartão por aula, com quanto o professor recebe, e o formulário de nova aula. */
export default async function ServicesPage() {
  const teacherId = await requireTeacher();
  const { db, config } = appDeps();
  const services = await db.selectFrom('services').selectAll().where('teacher_id', '=', teacherId)
    .orderBy('active', 'desc').orderBy('modality').execute();
  const subjects = await db.selectFrom('teacher_subjects').innerJoin('subjects', 'subjects.id', 'teacher_subjects.subject_id')
    .select(['subjects.id', 'subjects.name']).distinct().where('teacher_id', '=', teacherId).execute();
  const floor = config.priceFloorCents;
  const link = config.commissionBps.teacher_link;
  const search = config.commissionBps.marketplace;
  const pct = (bps: number) => `${(bps / 100).toLocaleString('pt-BR')}%`;
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="font-display tracking-tight text-3xl font-normal">Serviços e preços</h1>
        <p className="text-site-muted">
          Você define o preço{floor > 0 ? ` (mínimo da plataforma: ${formatBRL(floor)})` : ''}. A Reforce fica com {pct(link)} quando o aluno chega pelo
          seu link e {pct(search)} quando chega pela busca. Mudanças valem para as próximas reservas.
        </p>
      </div>

      <ul className="grid gap-3 lg:grid-cols-2" data-testid="servicos">
        {services.length === 0 && <li className={`${CARD} text-site-muted`}>Nenhuma aula cadastrada ainda. Crie a primeira abaixo.</li>}
        {services.map((s) => (
          <li key={s.id} className={`${CARD} space-y-3 ${s.active ? '' : 'bg-violet-50/60'}`}>
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
              <div className="min-w-0">
                <p className="font-display tracking-tight text-lg font-normal">{subjectName(s.subject)} · {WHERE[s.modality]}</p>
                <p className="text-sm text-site-muted">
                  {duration(s.duration_min)}
                  {s.modality !== 'online' && (s.buffer_before_min > 0 || s.buffer_after_min > 0)
                    && ` · Deslocamento: ${s.buffer_before_min === s.buffer_after_min ? `${s.buffer_before_min} min antes e depois` : `${s.buffer_before_min} min antes e ${s.buffer_after_min} min depois`}`}
                </p>
              </div>
              <p className="font-display tracking-tight text-xl font-normal">{formatBRL(s.price_cents)}</p>
            </div>
            <p className="text-sm">
              Você recebe <strong>{formatBRL(splitCommission(s.price_cents, link).teacher)}</strong> pelo seu link e{' '}
              <strong>{formatBRL(splitCommission(s.price_cents, search).teacher)}</strong> pela busca.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {!s.active && (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">Pausado · não aparece para os alunos</span>
              )}
              <ActionForm action={updateServiceAction} submitLabel={s.active ? 'Pausar' : 'Reativar'} className="" buttonClassName="btn-secondary">
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="active" value={String(!s.active)} />
              </ActionForm>
            </div>
          </li>
        ))}
      </ul>

      <section className={CARD} aria-labelledby="nova-aula">
        <h2 id="nova-aula" className="mb-4 font-display tracking-tight text-xl font-normal">Nova aula</h2>
        {subjects.length === 0 ? (
          <p className="text-sm text-site-muted">
            Escolha suas disciplinas em <Link className="font-medium text-indigo-600 underline" href="/professor/cadastro">Meu perfil</Link>.
          </p>
        ) : (
          <ServiceForm subjects={subjects} linkBps={link} searchBps={search} action={createServiceAction} />
        )}
      </section>
    </div>
  );
}
