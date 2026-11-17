/**
 * Formulário da busca lido da URL (/buscar?disciplina=…): valores fora do
 * catálogo são ignorados, como se não tivessem sido escolhidos.
 */
import { describe, expect, it } from 'vitest';
import { parseSearchForm } from '@/lib/search-form';

describe('formulário da busca', () => {
  it('tem padrões quando nada foi escolhido', () => {
    expect(parseSearchForm({})).toEqual({
      subjectId: null, gradeId: null, modality: 'online', cep: '', maxPriceCents: null, q: '', page: 1,
    });
  });

  it('lê os valores válidos', () => {
    expect(parseSearchForm({
      disciplina: '1', serie: '9', modalidade: 'at_student', cep: '01310-100', preco: '150', q: ' enem ', pagina: '2',
    })).toEqual({
      subjectId: 1, gradeId: 9, modality: 'at_student', cep: '01310100', maxPriceCents: 15000, q: 'enem', page: 2,
    });
  });

  it('ignora valores inválidos', () => {
    expect(parseSearchForm({ disciplina: 'abc', serie: '999', modalidade: 'voar', preco: '-3', pagina: '0' })).toEqual({
      subjectId: null, gradeId: null, modality: 'online', cep: '', maxPriceCents: null, q: '', page: 1,
    });
  });
});
