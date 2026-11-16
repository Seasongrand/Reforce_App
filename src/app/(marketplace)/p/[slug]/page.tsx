import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SlotPicker } from '@/components/SlotPicker';
import { publicTeacherPage } from '@/domain/public/teacher-page';
import { formatBRL } from '@/lib/money';
import { appDeps, now } from '@/server/app';

export const dynamic = 'force-dynamic';

const MODALITY: Record<string, string> = { online: 'Online', at_teacher: 'No endereço do professor', at_student: 'Na sua casa' };
const BADGE: Record<string, string> = { identity: 'Identidade conferida', criminal_record: 'Antecedentes criminais', education: 'Formação conferida' };
const br = (d: string) => d.split('-').reverse().join('/');

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const page = await publicTeacherPage(appDeps(), (await params).slug, await now());
  return { title: page ? `${page.name}: aulas particulares` : 'Professor não encontrado' };
}

export default async function TeacherPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const deps = appDeps();
  const page = await publicTeacherPage(deps, slug, await now());
  if (!page) notFound();
  const link = `${deps.config.appBaseUrl}/p/${page.slug}`;
  const share = `https://wa.me/?text=${encodeURIComponent(`Achei este professor para as minhas aulas: ${page.name}. Dá uma olhada e reserve comigo? ${link}`)}`;
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{page.name}</h1>
        {page.headline && <p className="text-slate-700">{page.headline}</p>}
      </header>
      {page.badges.length === 3 && (
        <ul className="flex flex-wrap gap-2 text-xs" aria-label="Verificações">
          {page.badges.map((b) => (
            <li key={b.kind} className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800">
              ✓ {BADGE[b.kind]}{b.validUntil ? `, válido até ${br(b.validUntil)}` : ''}
            </li>
          ))}
        </ul>
      )}
      {page.subjects.length > 0 && (
        <p className="text-sm text-slate-700">
          {page.subjects.map((s) => `${s.subject} (${s.grades.join(', ')})`).join(' · ')}
        </p>
      )}
      {page.bio && <p className="whitespace-pre-line text-slate-800">{page.bio}</p>}

      <section className="card space-y-4">
        <h2 className="text-lg font-medium">Horários livres</h2>
        {page.sellable ? (
          <SlotPicker slug={page.slug} teacherTz={page.timezone}
            services={page.services.map((s) => ({
              id: s.id,
              label: `${s.subject} · ${MODALITY[s.modality]} · ${s.durationMin} min · ${formatBRL(s.priceCents)}`,
              slots: s.slots,
            }))} />
        ) : (
          <p className="notice">Agenda indisponível no momento.</p>
        )}
      </section>
      <p className="text-sm">
        É aluno? <a className="text-brand underline" href={share} target="_blank" rel="noreferrer">Enviar para meu responsável pelo WhatsApp</a>.
        A reserva e o pagamento são feitos por um adulto.
      </p>
    </div>
  );
}
