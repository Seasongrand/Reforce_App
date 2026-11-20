import { ActionForm } from '@/components/ActionForm';
import { formatKm, formatPhoneBR } from '@/lib/format-br';
import { ProfileEditor } from '@/components/professor/ProfileEditor';
import { publicTeacherPage } from '@/domain/public/teacher-page';
import { BRAZIL_TIMEZONES, currentYearSaoPaulo, MAX_SPECIALTIES, TEACHER_SPECIALTIES } from '@/domain/teachers/profile';
import { teacherPhotoState } from '@/domain/teachers/photo';
import { teacherServiceSummary } from '@/domain/teachers/service-summary';
import { zoneLabel } from '@/time/zoned';
import { appDeps, now } from '@/server/app';
import { requireTeacher } from '@/server/session';
import { saveProfileAction, uploadPhotoAction } from '../actions';

export const dynamic = 'force-dynamic';

/** Meu perfil: a foto e o editor com a prévia de como os alunos veem a página. */
export default async function TeacherProfilePage() {
  const teacherId = await requireTeacher();
  const deps = appDeps();
  const db = deps.db;
  const at = await now();
  const t = await db.selectFrom('teachers').selectAll().where('id', '=', teacherId).executeTakeFirstOrThrow();
  const subjects = await db.selectFrom('subjects').select(['id', 'name']).orderBy('id').execute();
  const grades = await db.selectFrom('grade_levels').select(['id', 'name']).orderBy('id').execute();
  const chosen = (await db.selectFrom('teacher_subjects').select(['subject_id', 'grade_level_id']).where('teacher_id', '=', teacherId).execute())
    .map((r) => `${r.subject_id}:${r.grade_level_id}`);
  const photo = await teacherPhotoState(deps, teacherId);
  const verified = t.status === 'approved' && Boolean((await publicTeacherPage(deps, t.slug, at))?.verified);
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-bold tracking-tight">Meu perfil</h1>
        <p className="text-[15px] text-site-muted">O que você preencher aqui aparece na sua página. A prévia ao lado mostra como os alunos vão ver.</p>
      </div>
      <section className="card space-y-3" data-testid="foto">
        <h2 className="text-lg font-medium">Sua foto</h2>
        <p className="text-sm text-slate-600">
          Uma foto do rosto, de frente e com boa luz. A equipe confere com o seu documento de identidade antes de ela
          aparecer na sua página.
        </p>
        <div className="flex flex-wrap gap-4">
          {photo.approvedDataUrl && (
            <figure className="space-y-1 text-center text-xs text-slate-600">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.approvedDataUrl} alt="Sua foto aprovada" width={96} height={96} className="rounded-xl" />
              <figcaption>Aprovada</figcaption>
            </figure>
          )}
          {photo.pending && (
            <figure className="space-y-1 text-center text-xs text-slate-600">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.pending.dataUrl} alt="Sua foto em análise" width={96} height={96} className="rounded-xl" />
              <figcaption>Em análise</figcaption>
            </figure>
          )}
        </div>
        {photo.rejectedNote && <p className="error">Foto recusada: {photo.rejectedNote}. Envie outra.</p>}
        {!photo.approvedDataUrl && !photo.pending && !photo.rejectedNote && (
          <p className="text-sm text-slate-600">Nenhuma foto enviada ainda. Sem foto aprovada, o perfil não é aprovado.</p>
        )}
        <ActionForm action={uploadPhotoAction} submitLabel="Enviar foto" successMessage="Foto enviada para análise." className="space-y-2">
          <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required aria-label="Foto"
            className="block text-sm" />
          <p className="text-xs text-slate-500">JPG, PNG ou WEBP, até 5 MB.</p>
        </ActionForm>
      </section>
      <ProfileEditor
        action={saveProfileAction}
        initial={{
          displayName: t.display_name, slug: t.slug.startsWith('professor-') ? '' : t.slug, headline: t.headline ?? '',
          bio: t.bio ?? '', timezone: t.timezone, phone: formatPhoneBR(t.phone_e164), whatsappOptIn: t.whatsapp_opt_in_at !== null,
          baseCep: t.base_cep ?? '', travelRadiusKm: formatKm(t.travel_radius_km), teachingAddress: t.teaching_address ?? '',
          subjects: chosen, specialties: t.specialties, teachingSince: t.teaching_since ? String(t.teaching_since) : '',
        }}
        subjects={subjects}
        grades={grades}
        timezones={BRAZIL_TIMEZONES.map((z) => ({ value: z, label: zoneLabel(z) }))}
        specialties={Object.entries(TEACHER_SPECIALTIES).map(([value, label]) => ({ value, label }))}
        maxSpecialties={MAX_SPECIALTIES}
        baseUrl={deps.config.appBaseUrl}
        photoUrl={photo.approvedDataUrl ?? photo.pending?.dataUrl ?? null}
        verified={verified}
        services={await teacherServiceSummary(db, teacherId)}
        currentYear={currentYearSaoPaulo(at)}
      />
    </div>
  );
}
