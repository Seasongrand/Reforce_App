/**
 * Origem da família (comissão: 15% pela busca, 5% pelo link do professor).
 * A primeira visita ao perfil marca a origem e ela não muda depois: quem
 * chegou pelo link do professor fica com 5% mesmo que depois o ache na busca.
 */
import { describe, expect, it } from 'vitest';
import { acquisitionFor, originCookieName, originToRecord } from '@/domain/family-origin';

describe('origem da família', () => {
  it('a primeira visita ao perfil marca a origem: pela busca ou não', () => {
    expect(originToRecord({ path: '/p/ana-matematica', searchOrigin: 'busca', existing: undefined })).toBe('busca');
    expect(originToRecord({ path: '/p/ana-matematica', searchOrigin: null, existing: undefined })).toBe('link');
    expect(originToRecord({ path: '/p/ana-matematica', searchOrigin: 'outra', existing: undefined })).toBe('link');
  });

  it('a marca não muda: quem chegou pelo link e depois veio da busca continua link, e vice-versa', () => {
    expect(originToRecord({ path: '/p/ana-matematica', searchOrigin: 'busca', existing: 'link' })).toBeNull();
    expect(originToRecord({ path: '/p/ana-matematica', searchOrigin: null, existing: 'busca' })).toBeNull();
  });

  it('só a página do professor marca; outras páginas não', () => {
    for (const path of ['/p/ana-matematica/reservar', '/buscar', '/p/', '/p/Ana_X', '/conta']) {
      expect(originToRecord({ path, searchOrigin: 'busca', existing: undefined })).toBeNull();
    }
  });

  it('a marca vira a origem do vínculo; sem marca, vale o link do professor', () => {
    expect(acquisitionFor('busca')).toBe('marketplace');
    expect(acquisitionFor('link')).toBe('teacher_link');
    expect(acquisitionFor(undefined)).toBe('teacher_link');
    expect(originCookieName('ana-matematica')).toBe('origem_ana-matematica');
  });
});
