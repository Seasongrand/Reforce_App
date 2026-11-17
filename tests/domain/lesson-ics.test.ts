/**
 * "Adicionar à minha agenda": arquivo de calendário (iCalendar, RFC 5545) da
 * aula confirmada, que funciona no Google Agenda, no iPhone e no Outlook.
 */
import { describe, expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill';
import { lessonIcs } from '@/domain/lessons/ics';

const base = {
  uid: '6f1c2c1e-0000-4000-8000-000000000001',
  startsAt: Temporal.Instant.from('2026-11-18T18:00:00Z'),
  endsAt: Temporal.Instant.from('2026-11-18T19:00:00Z'),
  summary: 'Aula de Matemática com Ana Souza',
  description: 'Página da aula: https://reforce.up.railway.app/aula/abc',
  location: 'Online, na sala da Reforce',
  now: Temporal.Instant.from('2026-11-17T12:00:00Z'),
};

describe('arquivo de calendário da aula', () => {
  it('tem a estrutura e os horários em UTC, com linhas terminadas em CRLF', () => {
    const ics = lessonIcs(base);
    const lines = ics.split('\r\n');
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(ics.replaceAll('\r\n', '')).not.toContain('\n');
    expect(lines.slice(0, 4)).toEqual(['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Reforce//Aulas//PT-BR', 'METHOD:PUBLISH']);
    expect(lines).toContain('BEGIN:VEVENT');
    expect(lines).toContain('UID:6f1c2c1e-0000-4000-8000-000000000001@reforce');
    expect(lines).toContain('DTSTAMP:20261117T120000Z');
    expect(lines).toContain('DTSTART:20261118T180000Z');
    expect(lines).toContain('DTEND:20261118T190000Z');
    expect(lines).toContain('SUMMARY:Aula de Matemática com Ana Souza');
    expect(lines.at(-2)).toBe('END:VCALENDAR');
  });

  it('escapa vírgula, ponto e vírgula, barra invertida e quebra de linha', () => {
    const ics = lessonIcs({ ...base, summary: 'Aula; Física, com Zé \\ Silva', location: 'Rua A, 10\nApto 2' });
    const unfolded = ics.replaceAll('\r\n ', '');
    expect(unfolded).toContain('SUMMARY:Aula\\; Física\\, com Zé \\\\ Silva');
    expect(unfolded).toContain('LOCATION:Rua A\\, 10\\nApto 2');
  });

  it('dobra linhas de mais de 75 bytes sem quebrar acentos', () => {
    const long = 'Página da aula: ' + 'é'.repeat(80);
    const ics = lessonIcs({ ...base, description: long });
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(ics.replaceAll('\r\n ', '')).toContain(`DESCRIPTION:${long}`);
  });
});
