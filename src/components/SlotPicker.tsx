'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Temporal } from 'temporal-polyfill';
import { formatDatePtBr, formatTime, groupByViewerDate, zoneLabel } from '@/time/zoned';

export interface SlotService {
  id: string;
  label: string;
  slots: string[];
}

/** Horários livres agrupados pela data de quem vê, no fuso do navegador (§2.3, passo 5). */
export function SlotPicker({ slug, services, teacherTz }: { slug: string; services: SlotService[]; teacherTz: string }) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '');
  // o servidor não sabe o fuso de quem vê: começa no do professor e troca depois de montar
  const [viewerTz, setViewerTz] = useState(teacherTz);
  useEffect(() => setViewerTz(Intl.DateTimeFormat().resolvedOptions().timeZone), []);
  const service = services.find((s) => s.id === serviceId);
  const groups = useMemo(
    () => groupByViewerDate((service?.slots ?? []).map((s) => Temporal.Instant.from(s)), viewerTz),
    [service, viewerTz],
  );
  if (services.length === 0) return <p className="text-sm text-slate-600">Nenhum serviço disponível.</p>;
  return (
    <div className="space-y-4">
      {services.length > 1 && (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Serviço">
          {services.map((s) => (
            <button key={s.id} type="button" role="radio" aria-checked={s.id === serviceId}
              className={s.id === serviceId ? 'btn' : 'btn-secondary'} onClick={() => setServiceId(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
      )}
      {viewerTz !== teacherTz && (
        <p className="text-xs text-slate-500">Horários no seu fuso ({zoneLabel(viewerTz)}).</p>
      )}
      {groups.size === 0 && <p className="text-sm text-slate-600">Sem horários livres nos próximos dias.</p>}
      {[...groups.entries()].map(([day, slots]) => (
        <div key={day}>
          <p className="mb-1 text-sm font-medium">{formatDatePtBr(Temporal.PlainDate.from(day))}</p>
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => (
              <Link key={s.toString()} className="btn-secondary" data-slot={s.toString()}
                href={`/p/${slug}/reservar?servico=${serviceId}&inicio=${encodeURIComponent(s.toString())}`}>
                {formatTime(s, viewerTz)}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
