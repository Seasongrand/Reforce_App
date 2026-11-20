import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LocalWhen } from '@/components/aluno/LocalWhen';
import { ProfileBooking } from '@/components/aluno/ProfileBooking';
import { ProtectedNote } from '@/components/aluno/ProtectedNote';
import { TeacherProfileView } from '@/components/aluno/TeacherProfileView';
import { publicTeacherPage } from '@/domain/public/teacher-page';
import { appDeps, now } from '@/server/app';

export const dynamic = 'force-dynamic';

const br = (d: string) => d.split('-').reverse().join('/');

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const page = await publicTeacherPage(appDeps(), (await params).slug, await now());
  return { title: page ? `${page.name}: aulas particulares · Reforce` : 'Professor não encontrado' };
}

export default async function TeacherPublicPage({
  params, searchParams,
}: { params: Promise<{ slug: string }>; searchParams: Promise<{ serie?: string }> }) {
  const { slug } = await params;
  const { serie } = await searchParams;
  const deps = appDeps();
  const page = await publicTeacherPage(deps, slug, await now());
  if (!page) notFound();
  const link = `${deps.config.appBaseUrl}/p/${page.slug}`;
  const share = `https://wa.me/?text=${encodeURIComponent(`Achei este professor para as minhas aulas: ${page.name}. Dá uma olhada e reserve comigo? ${link}`)}`;
  const record = page.badges.find((b) => b.kind === 'criminal_record');
  const durations = [...new Set(page.services.map((s) => s.durationMin))].sort((a, b) => a - b);
  return (
    <TeacherProfileView
      name={page.name}
      photoUrl={page.photoUrl}
      verified={page.verified}
      headline={page.headline}
      experience={page.experience}
      minPriceCents={page.minPriceCents}
      durations={durations}
      modalities={page.modalities}
      specialties={page.specialties}
      subjects={page.subjects}
      bio={page.bio}
      stats={page.sellable}
      statExtra={{
        label: 'Próximo horário',
        value: page.nextSlot ? <LocalWhen iso={page.nextSlot} teacherTz={page.timezone} /> : 'Sem horários',
      }}
      afterStats={page.verified && (
        <details className="rounded-2xl border border-site-line px-3.5 py-1">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">O que verificamos</summary>
          <ul className="mb-3 space-y-2 text-sm text-site-muted">
            <li>✓ Identidade conferida</li>
            <li>✓ Certidão de antecedentes criminais{record?.validUntil ? `, válida até ${br(record.validUntil)}` : ''}</li>
            <li>✓ Formação conferida</li>
          </ul>
        </details>
      )}
    >
      {page.sellable ? (
        <ProfileBooking slug={page.slug} teacherTz={page.timezone} services={page.services} gradeSlug={serie} />
      ) : (
        <p className="notice mt-7">Agenda indisponível no momento.</p>
      )}

      {page.rating && (
        <section id="avaliacoes" className="space-y-3 pt-7">
          <h2 className="font-display text-xl font-bold">
            Avaliações <span className="text-base font-semibold text-site-muted">
              <span aria-hidden="true" className="text-yellow-500">★</span> {page.rating.average.toFixed(1).replace('.', ',')} · {page.rating.count}
            </span>
          </h2>
          <ul className="space-y-3">
            {page.reviews.map((r, i) => (
              <li key={i} className="space-y-1.5 rounded-2xl border border-site-line p-4">
                <p className="text-sm">
                  <span aria-label={`${r.rating} de 5`} className="text-yellow-500">{'★'.repeat(r.rating)}<span className="text-site-line">{'★'.repeat(5 - r.rating)}</span></span>
                  <span className="text-site-muted"> · {r.author} · {r.date.split('-').reverse().join('/')}</span>
                </p>
                {r.comment && <p className="whitespace-pre-line text-[15px] leading-relaxed text-[#3b3870]">{r.comment}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="pt-7">
        <ProtectedNote title="Sua aula protegida">
          <p><strong className="text-indigo-950">Pagamento na reserva,</strong> por PIX ou cartão. O valor só vai para o professor depois da aula.</p>
          <p><strong className="text-indigo-950">Se o professor faltar,</strong> o dinheiro volta inteiro, sem precisar pedir.</p>
          <p><strong className="text-indigo-950">Aula online na sala da Reforce,</strong> direto no navegador, sem instalar nada.</p>
        </ProtectedNote>
      </section>

      <section className="pt-6">
        <a href={share} target="_blank" rel="noreferrer"
          className="flex min-h-12 items-center justify-center rounded-2xl border border-site-field text-[15px] font-semibold text-indigo-950">
          É aluno? Mande para seu responsável
        </a>
        <p className="mt-2 text-center text-[13px] text-site-muted">A reserva e o pagamento são feitos por um adulto.</p>
      </section>
    </TeacherProfileView>
  );
}
