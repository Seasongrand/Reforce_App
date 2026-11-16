import Link from 'next/link';
import { ActionForm } from '@/components/ActionForm';
import { BRAZIL_TIMEZONES } from '@/domain/teachers/profile';
import { zoneLabel } from '@/time/zoned';
import { appDeps } from '@/server/app';
import { requireTeacher } from '@/server/session';
import { saveProfileAction } from '../actions';

export const dynamic = 'force-dynamic';

export default async function TeacherProfilePage() {
  const teacherId = await requireTeacher();
  const db = appDeps().db;
  const t = await db.selectFrom('teachers').selectAll().where('id', '=', teacherId).executeTakeFirstOrThrow();
  const subjects = await db.selectFrom('subjects').select(['id', 'name']).orderBy('id').execute();
  const grades = await db.selectFrom('grade_levels').select(['id', 'name']).orderBy('id').execute();
  const chosen = new Set(
    (await db.selectFrom('teacher_subjects').select(['subject_id', 'grade_level_id']).where('teacher_id', '=', teacherId).execute())
      .map((r) => `${r.subject_id}:${r.grade_level_id}`),
  );
  const base = appDeps().config.appBaseUrl;
  return (
    <div className="space-y-6">
      <Link href="/professor" className="text-sm text-brand">← Painel</Link>
      <h1 className="text-2xl font-semibold">Seu perfil</h1>
      <ActionForm action={saveProfileAction} submitLabel="Salvar perfil" successMessage="Perfil salvo.">
        <div>
          <label className="label" htmlFor="displayName">Nome na página</label>
          <input className="input" id="displayName" name="displayName" defaultValue={t.display_name} required />
        </div>
        <div>
          <label className="label" htmlFor="slug">Endereço da sua página</label>
          <div className="flex items-center gap-1 text-sm text-slate-600">
            <span>{base}/p/</span>
            <input className="input" id="slug" name="slug" required
              defaultValue={t.slug.startsWith('professor-') ? '' : t.slug} placeholder="ana-souza" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="headline">Chamada</label>
          <input className="input" id="headline" name="headline" maxLength={120} defaultValue={t.headline ?? ''}
            placeholder="Matemática para o 9º ano e ensino médio" />
        </div>
        <div>
          <label className="label" htmlFor="bio">Apresentação: formação e experiência</label>
          <textarea className="input" id="bio" name="bio" rows={5} maxLength={2000} defaultValue={t.bio ?? ''} />
        </div>
        <fieldset>
          <legend className="label">Disciplinas e séries</legend>
          <div className="overflow-x-auto">
            <table className="text-sm">
              <thead>
                <tr><th></th>{grades.map((g) => <th key={g.id} className="px-1 font-normal text-slate-600">{g.name}</th>)}</tr>
              </thead>
              <tbody>
                {subjects.map((s) => (
                  <tr key={s.id}>
                    <th className="pr-2 text-left font-medium">{s.name}</th>
                    {grades.map((g) => (
                      <td key={g.id} className="text-center">
                        <input type="checkbox" name="subj" value={`${s.id}:${g.id}`} aria-label={`${s.name}, ${g.name}`}
                          defaultChecked={chosen.has(`${s.id}:${g.id}`)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </fieldset>
        <div>
          <label className="label" htmlFor="timezone">Fuso horário da sua agenda</label>
          <select className="input" id="timezone" name="timezone" defaultValue={t.timezone}>
            {BRAZIL_TIMEZONES.map((z) => <option key={z} value={z}>{zoneLabel(z)}</option>)}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="phone">WhatsApp para avisos de aula</label>
            <input className="input" id="phone" name="phone" defaultValue={t.phone_e164 ?? ''} placeholder="(11) 99999-9999" />
          </div>
          <label className="mt-6 flex items-center gap-2 text-sm">
            <input type="checkbox" name="whatsappOptIn" defaultChecked={t.whatsapp_opt_in_at !== null} />
            Aceito receber avisos de aula pelo WhatsApp
          </label>
        </div>
        <fieldset className="space-y-3">
          <legend className="label">Aula presencial</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="baseCep">CEP de onde você sai</label>
              <input className="input" id="baseCep" name="baseCep" defaultValue={t.base_cep ?? ''} />
            </div>
            <div>
              <label className="label" htmlFor="travelRadiusKm">Raio de atendimento (km)</label>
              <input className="input" id="travelRadiusKm" name="travelRadiusKm" inputMode="decimal"
                defaultValue={t.travel_radius_km ?? ''} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="teachingAddress">Endereço onde você dá aula (só a família com aula paga vê)</label>
            <input className="input" id="teachingAddress" name="teachingAddress" defaultValue={t.teaching_address ?? ''} />
          </div>
        </fieldset>
      </ActionForm>
    </div>
  );
}
