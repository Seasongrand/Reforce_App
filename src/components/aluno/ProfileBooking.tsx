'use client';

/**
 * Escolha da aula e do horário no perfil do professor (tela 1): cartões de
 * serviço, calendário do mês com os horários no fuso de quem vê, e a barra
 * fixa com o horário escolhido e o botão "Reservar".
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatBRL } from '@/lib/money';
import { shortWhen } from '@/lib/profile-days';
import { zoneLabel } from '@/time/zoned';
import { MonthSlots } from './MonthSlots';

export interface BookingService {
  id: string;
  subject: string;
  modality: 'online' | 'at_teacher' | 'at_student';
  durationMin: number;
  priceCents: number;
  slots: string[];
}

const TITLE: Record<BookingService['modality'], string> = {
  online: 'online',
  at_student: 'na sua casa',
  at_teacher: 'no endereço do professor',
};
const NOTE: Record<BookingService['modality'], string> = {
  online: 'na sala da Reforce',
  at_student: 'o professor vai até você',
  at_teacher: 'endereço informado depois do pagamento',
};

export function ProfileBooking({ slug, teacherTz, services, gradeSlug }: {
  slug: string; teacherTz: string; services: BookingService[]; gradeSlug?: string;
}) {
  const [serviceId, setServiceId] = useState((services.find((s) => s.slots.length > 0) ?? services[0])?.id ?? '');
  // o servidor não sabe o fuso de quem vê: começa no do professor e troca depois de montar
  const [viewerTz, setViewerTz] = useState(teacherTz);
  useEffect(() => setViewerTz(Intl.DateTimeFormat().resolvedOptions().timeZone), []);
  const service = services.find((s) => s.id === serviceId);
  const [slot, setSlot] = useState<string | null>(null);

  const pickService = (id: string) => {
    setServiceId(id);
    setSlot(null);
  };

  if (services.length === 0) return <p className="text-site-muted">Nenhuma aula disponível no momento.</p>;
  return (
    <>
      <section className="space-y-3 pt-7">
        <h2 className="font-display text-xl font-bold">Escolha a aula</h2>
        <div role="radiogroup" aria-label="Aula" className="space-y-2.5">
          {services.map((s) => {
            const on = s.id === serviceId;
            return (
              <button key={s.id} type="button" role="radio" aria-checked={on} onClick={() => pickService(s.id)}
                className={`flex w-full items-center gap-3 rounded-2xl p-3.5 text-left ${on ? 'border-2 border-indigo-600 bg-indigo-50' : 'border border-site-field bg-white'}`}>
                <span aria-hidden="true" className={`flex size-5 flex-none items-center justify-center rounded-full border-2 ${on ? 'border-indigo-600' : 'border-site-field'}`}>
                  {on && <span className="size-2.5 rounded-full bg-indigo-600" />}
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-[15px]">{s.subject} {TITLE[s.modality]}</strong>
                  <span className="text-[13px] text-site-muted">{s.durationMin} min · {NOTE[s.modality]}</span>
                </span>
                <strong>{formatBRL(s.priceCents)}</strong>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3 pt-7">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-xl font-bold">Horários livres</h2>
          <span className="text-[13px] text-site-muted">
            {viewerTz === teacherTz ? 'no seu horário' : `no seu horário (${zoneLabel(viewerTz)})`}
          </span>
        </div>
        <MonthSlots key={`${service?.id}-${viewerTz}`} slots={service?.slots ?? []} tz={viewerTz} selected={slot} onPick={setSlot} />
      </section>

      {service && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-site-line bg-white">
          <div className="mx-auto flex max-w-2xl items-center gap-3 px-5 pb-5 pt-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-site-muted">{slot ? shortWhen(slot, viewerTz) : 'Escolha um horário'}</p>
              <p className="text-[17px] font-bold">{formatBRL(service.priceCents)} · {service.durationMin} min</p>
            </div>
            {slot ? (
              <Link href={`/p/${slug}/reservar?servico=${service.id}&inicio=${encodeURIComponent(slot)}${gradeSlug && /^[a-z0-9]+$/.test(gradeSlug) ? `&serie=${gradeSlug}` : ''}`}
                className="inline-flex min-h-13 items-center rounded-2xl bg-indigo-600 px-6 text-base font-semibold text-white hover:bg-indigo-700">
                Reservar
              </Link>
            ) : (
              <span aria-disabled="true" className="inline-flex min-h-13 items-center rounded-2xl bg-site-line px-6 text-base font-semibold text-site-muted">
                Reservar
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}
