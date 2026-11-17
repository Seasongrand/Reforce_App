/** Perguntas frequentes da página dos professores: as comissões vêm da configuração. */
import { describe, expect, it } from 'vitest';
import { FAQ, faqWithCommission } from '@/components/site/content';

describe('perguntas frequentes', () => {
  it('troca {busca} e {link} pelas comissões configuradas, em formato brasileiro', () => {
    const faq = faqWithCommission({ marketplace: 1500, teacher_link: 500 });
    const cost = faq.find((f) => f.q === 'Quanto custa para o professor?')!.a;
    expect(cost).toContain('a Reforce fica com 15% de cada aula paga por alunos que chegam pela busca');
    expect(cost).toContain('com só 5% das aulas dos alunos que você mesmo traz');
    expect(faq.find((f) => f.q === 'Posso levar os alunos que já tenho?')!.a).toContain('paga só 5% de comissão');
    expect(faqWithCommission({ marketplace: 1250, teacher_link: 0 })[0]!.a).toContain('fica com 12,5% de cada aula');
    expect(faq.every((f) => !/[{}]/.test(f.a))).toBe(true);
  });

  it('tem dez perguntas, sem repetir', () => {
    expect(FAQ).toHaveLength(10);
    expect(new Set(FAQ.map((f) => f.q)).size).toBe(10);
  });
});
