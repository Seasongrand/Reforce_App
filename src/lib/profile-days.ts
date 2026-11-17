/**
 * Dias e horários do perfil do professor, no fuso de quem vê (roda no
 * navegador). Os instantes chegam como texto ISO e saem iguais, para o link
 * de reserva levar o instante exato.
 */
import { Temporal } from 'temporal-polyfill';
import { formatTime, groupByViewerDate } from '@/time/zoned';

const WEEKDAY_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const MONTH_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export interface PickerDay {
  /** Data de quem vê, AAAA-MM-DD. */
  key: string;
  weekday: string;
  day: number;
  month: string;
  slots: string[];
}

export function daysForPicker(slots: string[], viewerTz: string): PickerDay[] {
  const byIso = new Map(slots.map((s) => [Temporal.Instant.from(s).toString(), s]));
  const groups = groupByViewerDate([...byIso.keys()].map((s) => Temporal.Instant.from(s)), viewerTz);
  return [...groups.entries()].map(([key, instants]) => {
    const d = Temporal.PlainDate.from(key);
    return {
      key,
      weekday: WEEKDAY_SHORT[d.dayOfWeek - 1]!,
      day: d.day,
      month: MONTH_SHORT[d.month - 1]!,
      slots: instants.map((i) => byIso.get(i.toString())!),
    };
  });
}

/** "Ter, 17 de nov · 22:00" no fuso de quem vê. */
export function shortWhen(instantIso: string, tz: string): string {
  const instant = Temporal.Instant.from(instantIso);
  const d = instant.toZonedDateTimeISO(tz).toPlainDate();
  return `${WEEKDAY_SHORT[d.dayOfWeek - 1]}, ${d.day} de ${MONTH_SHORT[d.month - 1]} · ${formatTime(instant, tz)}`;
}
