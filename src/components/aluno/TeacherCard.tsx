import Link from 'next/link';
import type { SearchItem } from '@/domain/search/teachers';
import { formatBRL } from '@/lib/money';
import { LocalWhen } from './LocalWhen';
import { TeacherPhoto } from './TeacherPhoto';

/** Cartão de professor na vitrine: o cartão inteiro leva ao perfil. */
export function TeacherCard({ item, viewerTzFallback, gradeSlug }: { item: SearchItem; viewerTzFallback: string; gradeSlug?: string }) {
  return (
    <Link href={`/p/${item.slug}?${gradeSlug ? `serie=${gradeSlug}&` : ''}origem=busca`}
      className="flex gap-4 rounded-[20px] border border-site-line bg-white p-4 text-indigo-950 transition hover:-translate-y-0.5 hover:border-indigo-600">
      <TeacherPhoto photoUrl={item.photoUrl} name={item.name} size={72} />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="font-display tracking-tight text-lg font-normal leading-tight">{item.name}</p>
          <span className="inline-flex items-center gap-1 rounded-lg bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            Perfil verificado
          </span>
        </div>
        {item.headline && <p className="line-clamp-2 text-sm text-[#3b3870]">{item.headline}</p>}
        <p className="text-[13px] text-site-muted">
          {item.rating !== null
            ? <><span aria-hidden="true" className="text-yellow-500">★</span> {item.rating.toFixed(1).replace('.', ',')} ({item.reviews} {item.reviews === 1 ? 'avaliação' : 'avaliações'})</>
            : 'Novo na Reforce'}
          {item.km !== null && <> · a {item.km.toFixed(1).replace('.', ',')} km</>}
        </p>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 pt-1">
          <p className="text-sm">A partir de <strong className="text-base">{formatBRL(item.minPriceCents)}</strong></p>
          <p className="text-[13px] font-medium text-indigo-600">
            Próximo horário: <LocalWhen iso={item.nextSlot} teacherTz={viewerTzFallback} />
          </p>
        </div>
      </div>
    </Link>
  );
}
