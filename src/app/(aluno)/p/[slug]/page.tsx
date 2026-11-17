import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LocalWhen } from '@/components/aluno/LocalWhen';
import { ProfileBooking } from '@/components/aluno/ProfileBooking';
import { ProtectedNote } from '@/components/aluno/ProtectedNote';
import { TeacherPhoto } from '@/components/aluno/TeacherPhoto';
import { publicTeacherPage } from '@/domain/public/teacher-page';
import { formatBRL } from '@/lib/money';
import { appDeps, now } from '@/server/app';

export const dynamic = 'force-dynamic';

const MODALITY: Record<string, string> = { online: 'Online', at_student: 'na sua casa', at_teacher: 'no endereço do professor' };
const br = (d: string) => d.split('-').reverse().join('/');

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const page = await publicTeacherPage(appDeps(), (await params).slug, await now());
  return { title: page ? `${page.name}: aulas particulares · Reforce` : 'Professor não encontrado' };
}

function joinPt(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} e ${items.at(-1)}`;
}

export default async function TeacherPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const deps = appDeps();
  const page = await publicTeacherPage(deps, slug, await now());
  if (!page) notFound();
  const link = `${deps.config.appBaseUrl}/p/${page.slug}`;
  const share = `https://wa.me/?text=${encodeURIComponent(`Achei este professor para as minhas aulas: ${page.name}. Dá uma olhada e reserve comigo? ${link}`)}`;
  const record = page.badges.find((b) => b.kind === 'criminal_record');
  const modalities = joinPt(page.modalities.map((m, i) => (i === 0 ? MODALITY[m]! : MODALITY[m]!.toLowerCase())));
  return (
    <div>
      <section className="space-y-4">
        <div className="flex items-center gap-4">
          <TeacherPhoto photoUrl={page.photoUrl} name={page.name} size={96} />
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="font-display text-[28px] font-bold leading-tight">{page.name}</h1>
            {page.verified && (
              <span className="inline-flex items-center gap-1.5 self-start rounded-[10px] bg-green-100 px-2.5 py-1.5 text-[13px] font-semibold text-green-800">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                Perfil verificado
              </span>
            )}
            {page.rating && (
              <a href="#avaliacoes" className="text-sm font-semibold text-indigo-950">
                <span aria-hidden="true" className="text-yellow-500">★</span> {page.rating.average.toFixed(1).replace('.', ',')}
                <span className="font-normal text-site-muted"> · {page.rating.count} {page.rating.count === 1 ? 'avaliação' : 'avaliações'}</span>
              </a>
            )}
          </div>
        </div>
        {page.headline && <p className="text-[17px] font-medium leading-normal">{page.headline}</p>}

        {page.sellable && (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-violet-50 p-3">
              <p className="text-xs text-site-muted">A partir de</p>
              <p className="mt-0.5 text-[17px] font-bold">{page.minPriceCents !== null ? formatBRL(page.minPriceCents) : '—'}</p>
            </div>
            <div className="rounded-2xl bg-violet-50 p-3">
              <p className="text-xs text-site-muted">Aulas</p>
              <p className="mt-0.5 text-sm font-semibold">{modalities || '—'}</p>
            </div>
            <div className="rounded-2xl bg-violet-50 p-3">
              <p className="text-xs text-site-muted">Próximo horário</p>
              <p className="mt-0.5 text-sm font-semibold">
                {page.nextSlot ? <LocalWhen iso={page.nextSlot} teacherTz={page.timezone} /> : 'Sem horários'}
              </p>
            </div>
          </div>
        )}

        {page.verified && (
          <details className="rounded-2xl border border-site-line px-3.5 py-1">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">O que verificamos</summary>
            <ul className="mb-3 space-y-2 text-sm text-site-muted">
              <li>✓ Identidade conferida</li>
              <li>✓ Certidão de antecedentes criminais{record?.validUntil ? `, válida até ${br(record.validUntil)}` : ''}</li>
              <li>✓ Formação conferida</li>
            </ul>
          </details>
        )}
      </section>

      {page.subjects.length > 0 && (
        <section className="space-y-2.5 pt-6">
          <h2 className="font-display text-xl font-bold">Dá aula de</h2>
          <ul className="flex flex-wrap gap-2">
            {page.subjects.map((s) => (
              <li key={s.subject} className="rounded-xl border border-site-field px-3 py-2 text-sm">
                <strong>{s.subject}</strong> · {s.grades.join(', ')}
              </li>
            ))}
          </ul>
        </section>
      )}

      {page.bio && (
        <section className="space-y-2.5 pt-6">
          <h2 className="font-display text-xl font-bold">Sobre</h2>
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-[#3b3870]">{page.bio}</p>
        </section>
      )}

      {page.sellable ? (
        <ProfileBooking slug={page.slug} teacherTz={page.timezone} services={page.services} />
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
    </div>
  );
}
