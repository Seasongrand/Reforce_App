/** Senha da área da equipe (HTTP Basic, a mesma das planilhas; o usuário é ignorado). */
import { describe, expect, it } from 'vitest';
import { teamPasswordMatches } from '@/domain/team-auth';

const basic = (raw: string) => `Basic ${Buffer.from(raw).toString('base64')}`;

describe('senha da equipe', () => {
  it('confere a senha, com qualquer usuário (inclusive vazio) e com ":" na senha', () => {
    expect(teamPasswordMatches('senha-longa:de-teste', basic('equipe:senha-longa:de-teste'))).toBe(true);
    expect(teamPasswordMatches('senha-longa-de-teste', basic(':senha-longa-de-teste'))).toBe(true);
  });

  it('recusa senha errada, cabeçalho ausente ou malformado, e quando não há senha configurada', () => {
    expect(teamPasswordMatches('senha-longa-de-teste', basic('equipe:errada'))).toBe(false);
    expect(teamPasswordMatches('senha-longa-de-teste', null)).toBe(false);
    expect(teamPasswordMatches('senha-longa-de-teste', 'Bearer x')).toBe(false);
    expect(teamPasswordMatches('senha-longa-de-teste', basic('sem-dois-pontos'))).toBe(false);
    expect(teamPasswordMatches(null, basic('equipe:'))).toBe(false);
    expect(teamPasswordMatches('', basic('equipe:'))).toBe(false);
  });
});
