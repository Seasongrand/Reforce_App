/**
 * Etapa 1 do formulário da lista de espera: a tela confere os dados de
 * contato antes de avançar, com as mesmas regras e mensagens do servidor
 * (`joinTeacherWaitlist`).
 */
import { describe, expect, it } from 'vitest';
import { step1Errors, stepOfServerError } from '@/lib/waitlist-step1';

const ok = { name: 'Bruna Lima', email: 'bruna@exemplo.com', phone: '', city: 'Campinas', state: 'sp' };

describe('etapa 1 da lista de espera', () => {
  it('aceita dados válidos, com WhatsApp vazio ou válido', () => {
    expect(step1Errors(ok)).toEqual({});
    expect(step1Errors({ ...ok, phone: '(11) 98888-7777' })).toEqual({});
  });

  it('mostra as mesmas mensagens do servidor', () => {
    expect(step1Errors({ name: ' Ab ', email: 'x@y', phone: '123', city: 'A', state: 'S1' })).toEqual({
      name: 'informe seu nome completo',
      email: 'e-mail inválido',
      phone: 'telefone inválido: informe DDD e número',
      city: 'informe sua cidade',
      state: 'UF inválida',
    });
  });

  it('sabe em que etapa está o erro do servidor', () => {
    for (const m of ['informe seu nome completo', 'e-mail inválido', 'telefone inválido: informe DDD e número', 'informe sua cidade', 'UF inválida']) {
      expect(stepOfServerError(m)).toBe(1);
    }
    expect(stepOfServerError('escolha ao menos uma disciplina da lista')).toBe(2);
    expect(stepOfServerError('Algo deu errado. Tente de novo em instantes.')).toBe(2);
  });
});
