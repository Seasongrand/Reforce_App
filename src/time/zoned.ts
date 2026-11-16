/**
 * Fuso e formatação. Regra (§2.1): hora local vira instante num lugar só, o
 * PostgreSQL. Aqui só se converte instante em hora local (sem ambiguidade),
 * lê o que vem do banco e formata para pessoas.
 */
import { Temporal } from 'temporal-polyfill';

export function toLocal(instant: Temporal.Instant, tz: string): Temporal.PlainDateTime {
  return instant.toZonedDateTimeISO(tz).toPlainDateTime();
}

/** timestamptz em texto do PostgreSQL ('2026-11-17 17:00:00.123+00') para Instant. */
export function instantFromDb(v: string): Temporal.Instant {
  const iso = v.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00');
  return Temporal.Instant.from(iso);
}

/** Instant para parâmetro de consulta (ISO em UTC). */
export function instantToDb(i: Temporal.Instant): string {
  return i.toString();
}

/** timestamp sem fuso ('2026-11-17 14:00:00') para PlainDateTime. */
export function plainFromDb(v: string): Temporal.PlainDateTime {
  return Temporal.PlainDateTime.from(v.replace(' ', 'T'));
}

export function plainToDb(p: Temporal.PlainDateTime): string {
  return p.toString({ smallestUnit: 'second' }).replace('T', ' ');
}

/** Data local (AAAA-MM-DD) de um instante para quem está no fuso `tz`. */
export function localDateKey(instant: Temporal.Instant, tz: string): string {
  return instant.toZonedDateTimeISO(tz).toPlainDate().toString();
}

/** Agrupa horários pela data de quem vê, em ordem cronológica (§2.3, passo 5). */
export function groupByViewerDate(slots: Temporal.Instant[], viewerTz: string): Map<string, Temporal.Instant[]> {
  const sorted = [...slots].sort((a, b) => Temporal.Instant.compare(a, b));
  const out = new Map<string, Temporal.Instant[]>();
  for (const s of sorted) {
    const key = localDateKey(s, viewerTz);
    const list = out.get(key);
    if (list) list.push(s);
    else out.set(key, [s]);
  }
  return out;
}

const WEEKDAYS = ['segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado', 'domingo'];
const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

const pad = (n: number) => String(n).padStart(2, '0');

export function formatTime(instant: Temporal.Instant, tz: string): string {
  const z = instant.toZonedDateTimeISO(tz);
  return `${pad(z.hour)}:${pad(z.minute)}`;
}

export function formatDatePtBr(date: Temporal.PlainDate): string {
  return `${WEEKDAYS[date.dayOfWeek - 1]}, ${date.day} de ${MONTHS[date.month - 1]}`;
}

/** "terça-feira, 17 de novembro, 14:00" no fuso pedido. */
export function formatPtBr(instant: Temporal.Instant, tz: string): string {
  const z = instant.toZonedDateTimeISO(tz);
  return `${formatDatePtBr(z.toPlainDate())}, ${formatTime(instant, tz)}`;
}

const ZONE_LABELS: Record<string, string> = {
  'America/Sao_Paulo': 'São Paulo',
  'America/Manaus': 'Manaus',
  'America/Noronha': 'Fernando de Noronha',
  'America/Rio_Branco': 'Rio Branco',
  'America/Cuiaba': 'Cuiabá',
  'America/Belem': 'Belém',
  'America/Fortaleza': 'Fortaleza',
  'America/Recife': 'Recife',
  'America/Bahia': 'Salvador',
  'America/Porto_Velho': 'Porto Velho',
  'America/Boa_Vista': 'Boa Vista',
  'America/Campo_Grande': 'Campo Grande',
};

export function zoneLabel(tz: string): string {
  return ZONE_LABELS[tz] ?? tz.split('/').pop()!.replaceAll('_', ' ');
}

/**
 * Horário para a confirmação: no fuso de quem lê e, quando a hora de parede
 * difere, também no fuso do professor (§1, "responsável em outro fuso").
 */
export function bothTimes(instant: Temporal.Instant, teacherTz: string, viewerTz: string): string {
  const viewer = toLocal(instant, viewerTz);
  const teacher = toLocal(instant, teacherTz);
  if (viewer.equals(teacher)) return formatPtBr(instant, viewerTz);
  const teacherPart = viewer.toPlainDate().equals(teacher.toPlainDate())
    ? formatTime(instant, teacherTz)
    : formatPtBr(instant, teacherTz);
  return `${formatPtBr(instant, viewerTz)} (horário de ${zoneLabel(viewerTz)}); ${teacherPart} no horário de ${zoneLabel(teacherTz)}`;
}
