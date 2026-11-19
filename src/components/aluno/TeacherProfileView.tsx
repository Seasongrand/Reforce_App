/**
 * Como o aluno vê o professor: o topo da página pública (foto, nome, selo,
 * chamada, experiência, preço, duração, modalidades), as especialidades, as
 * disciplinas e o "Sobre". A página pública e a prévia do editor de perfil
 * usam este mesmo componente, para a prévia nunca divergir do que o aluno vê.
 */
import { formatBRL } from '@/lib/money';
import { TeacherPhoto } from './TeacherPhoto';

type Modality = 'online' | 'at_teacher' | 'at_student';
const MODALITY: Record<Modality, string> = { online: 'Online', at_student: 'na sua casa', at_teacher: 'no endereço do professor' };

function joinPt(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} e ${items.at(-1)}`;
}

export interface TeacherProfileViewProps {
  name: string;
  photoUrl: string | null;
  verified: boolean;
  headline: string | null;
  /** "13 anos de experiência", ou null. */
  experience: string | null;
  minPriceCents: number | null;
  durations: number[];
  modalities: Modality[];
  specialties: string[];
  subjects: Array<{ subject: string; grades: string[] }>;
  bio: string | null;
  /** Mostra os quadros de preço, duração e modalidade (a página pública esconde quando não vende). */
  stats?: boolean;
  /** Um quadro a mais (a página pública mostra o próximo horário). */
  statExtra?: { label: string; value: React.ReactNode };
  /** Logo abaixo dos quadros (a página pública mostra o que foi verificado). */
  afterStats?: React.ReactNode;
  titleAs?: 'h1' | 'h2';
  children?: React.ReactNode;
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-violet-50 p-3">
      <p className="text-xs text-site-muted">{label}</p>
      <div className="mt-0.5 text-sm font-semibold">{children}</div>
    </div>
  );
}

export function TeacherProfileView(p: TeacherProfileViewProps) {
  const Title = p.titleAs ?? 'h1';
  const modalities = joinPt(p.modalities.map((m, i) => (i === 0 ? MODALITY[m] : MODALITY[m].toLowerCase())));
  const durations = p.durations.length === 0 ? null
    : p.durations.length === 1 ? `${p.durations[0]} min` : `${p.durations[0]} a ${p.durations.at(-1)} min`;
  return (
    // @container: os quadros seguem a largura da caixa (página inteira ou a prévia estreita), não a da tela
    <div className="@container">
      <section className="space-y-4">
        <div className="flex items-center gap-4">
          <TeacherPhoto photoUrl={p.photoUrl} name={p.name || 'Professor'} size={96} />
          <div className="flex min-w-0 flex-col gap-1.5">
            <Title className="font-display text-[28px] font-bold leading-tight [overflow-wrap:anywhere]">{p.name}</Title>
            {p.verified && (
              <span className="inline-flex items-center gap-1.5 self-start rounded-[10px] bg-green-100 px-2.5 py-1.5 text-[13px] font-semibold text-green-800">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                Perfil verificado
              </span>
            )}
            {p.experience && <p className="text-sm font-medium text-site-muted">{p.experience}</p>}
          </div>
        </div>
        {p.headline && <p className="text-[17px] font-medium leading-normal [overflow-wrap:anywhere]">{p.headline}</p>}

        {(p.stats ?? true) && (
          p.minPriceCents === null ? (
            <p className="rounded-2xl border border-dashed border-site-field p-3 text-sm text-site-muted">
              Defina o preço em Serviços e preços
            </p>
          ) : (
            <div className={`grid grid-cols-2 gap-2 ${p.statExtra ? '@lg:grid-cols-4' : '@md:grid-cols-3'}`}>
              <Stat label="A partir de"><span className="text-[17px] font-bold">{formatBRL(p.minPriceCents)}</span></Stat>
              <Stat label="Duração">{durations ?? '—'}</Stat>
              <Stat label="Aulas">{modalities || '—'}</Stat>
              {p.statExtra && <Stat label={p.statExtra.label}>{p.statExtra.value}</Stat>}
            </div>
          )
        )}
        {p.afterStats}
      </section>

      {p.specialties.length > 0 && (
        <section className="space-y-2.5 pt-6">
          <h2 className="font-display text-xl font-bold">Especialidades</h2>
          <ul className="flex flex-wrap gap-2">
            {p.specialties.map((s) => (
              <li key={s} className="rounded-full border border-site-field px-3.5 py-1.5 text-sm font-medium">{s}</li>
            ))}
          </ul>
        </section>
      )}

      {p.subjects.length > 0 && (
        <section className="space-y-2.5 pt-6">
          <h2 className="font-display text-xl font-bold">Dá aula de</h2>
          <ul className="flex flex-wrap gap-2">
            {p.subjects.map((s) => (
              <li key={s.subject} className="rounded-xl border border-site-field px-3 py-2 text-sm">
                <strong>{s.subject}</strong> · {s.grades.join(', ')}
              </li>
            ))}
          </ul>
        </section>
      )}

      {p.bio && (
        <section className="space-y-2.5 pt-6">
          <h2 className="font-display text-xl font-bold">Sobre</h2>
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-[#3b3870] [overflow-wrap:anywhere]">{p.bio}</p>
        </section>
      )}

      {p.children}
    </div>
  );
}
