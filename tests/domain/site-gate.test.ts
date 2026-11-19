/**
 * Porteiro do site (proxy): a área da equipe pede a senha; no modo lista de
 * espera, as rotas fechadas só abrem para quem traz a senha da equipe. Para
 * os demais, 404, sem pedir senha, para não revelar que existem.
 */
import { describe, expect, it } from 'vitest';
import { siteGate } from '@/domain/site-gate';

const PASSWORD = 'senha-de-teste-bem-longa';
const basic = (raw: string) => `Basic ${Buffer.from(raw).toString('base64')}`;
const RIGHT = basic(`equipe:${PASSWORD}`);
const WRONG = basic('equipe:outra-senha-qualquer');
const lista = (path: string, authorization: string | null) =>
  siteGate({ path, authorization, siteMode: 'lista_de_espera', password: PASSWORD });

describe('área da equipe', () => {
  it('pede a senha a quem não tem ou erra, e deixa entrar com a certa', () => {
    expect(lista('/equipe', null)).toBe('challenge');
    expect(lista('/equipe', WRONG)).toBe('challenge');
    expect(lista('/equipe', RIGHT)).toBe('next');
    expect(siteGate({ path: '/equipe', authorization: null, siteMode: 'completo', password: PASSWORD })).toBe('challenge');
  });

  it('sem senha configurada, a área não existe', () => {
    expect(siteGate({ path: '/equipe', authorization: RIGHT, siteMode: 'lista_de_espera', password: undefined })).toBe('not_found');
    expect(siteGate({ path: '/equipe', authorization: RIGHT, siteMode: 'lista_de_espera', password: '' })).toBe('not_found');
  });
});

describe('modo lista de espera', () => {
  it('abre as páginas públicas para todos, com ou sem senha', () => {
    expect(lista('/', null)).toBe('next');
    expect(lista('/entrar', WRONG)).toBe('next');
    expect(lista('/privacidade', RIGHT)).toBe('next');
  });

  it.each(['/professor', '/professor/cadastro', '/interno', '/conta', '/p/ana', '/api/interno/arquivos'])(
    '%s: 404 sem a senha ou com a errada; abre com a da equipe',
    (p) => {
      expect(lista(p, null)).toBe('not_found');
      expect(lista(p, WRONG)).toBe('not_found');
      expect(lista(p, RIGHT)).toBe('next');
    },
  );

  it('sem senha configurada, as rotas fechadas continuam fechadas para todos', () => {
    expect(siteGate({ path: '/professor', authorization: RIGHT, siteMode: 'lista_de_espera', password: undefined })).toBe('not_found');
  });
});

describe('site completo', () => {
  it('nada muda: as rotas do marketplace abrem sem senha', () => {
    expect(siteGate({ path: '/professor', authorization: null, siteMode: 'completo', password: PASSWORD })).toBe('next');
    expect(siteGate({ path: '/p/ana', authorization: null, siteMode: undefined, password: undefined })).toBe('next');
  });
});
