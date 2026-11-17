/**
 * Arquivo de calendário da aula confirmada (iCalendar, RFC 5545), para o botão
 * "Adicionar à minha agenda". Horários em UTC; linhas em CRLF, dobradas em 75
 * bytes sem partir caracteres acentuados.
 */
import type { Temporal } from 'temporal-polyfill';

export interface LessonIcsInput {
  uid: string;
  startsAt: Temporal.Instant;
  endsAt: Temporal.Instant;
  summary: string;
  description: string;
  location: string;
  now: Temporal.Instant;
}

const utc = (i: Temporal.Instant) => i.toString({ smallestUnit: 'second' }).replace(/[-:]/g, '');

const escape = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Dobra a linha em pedaços de até 75 bytes UTF-8; as continuações começam com espaço. */
function fold(line: string): string {
  const enc = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let size = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74; // a continuação gasta 1 byte com o espaço
    if (size + n > limit) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += ch;
    size += n;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

export function lessonIcs(input: LessonIcsInput): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Reforce//Aulas//PT-BR',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${input.uid}@reforce`,
    `DTSTAMP:${utc(input.now)}`,
    `DTSTART:${utc(input.startsAt)}`,
    `DTEND:${utc(input.endsAt)}`,
    `SUMMARY:${escape(input.summary)}`,
    `DESCRIPTION:${escape(input.description)}`,
    `LOCATION:${escape(input.location)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:-PT1H',
    `DESCRIPTION:${escape(input.summary)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}
