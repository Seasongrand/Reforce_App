/** Textos da página dos professores: as comissões vêm da configuração. */
import { describe, expect, it } from 'vitest';
import { FAQ, HERO, faqWithCommission, withCommission } from '@/components/site/content';

describe('perguntas frequentes', () => {
  it('troca {busca} e {link} pelas comissões configuradas, em formato brasileiro', () => {
    const faq = faqWithCommission({ marketplace: 1500, teacher_link: 500 });
    const cost = faq.find((f) => f.q === 'Quanto custa para o professor?')!.a;
    expect(cost).toContain('a Reforce fica com 15% das aulas de alunos que chegam pela busca');
    expect(cost).toContain('com 5% das aulas de alunos que você traz pelo seu link');
    expect(faq.find((f) => f.q === 'Posso levar os alunos que já tenho?')!.a).toContain('paga só 5% de comissão');
    expect(faqWithCommission({ marketplace: 1250, teacher_link: 0 })[0]!.a).toContain('fica com 12,5% das aulas');
    expect(faq.every((f) => !/[{}]/.test(f.a))).toBe(true);
  });

  it('tem dez perguntas, sem repetir, com respostas curtas', () => {
    expect(FAQ).toHaveLength(10);
    expect(new Set(FAQ.map((f) => f.q)).size).toBe(10);
    for (const f of FAQ) expect(f.a.split(/\s+/).length).toBeLessThanOrEqual(45);
  });

  it('o herói também usa a comissão configurada', () => {
    expect(withCommission(HERO.lead, { marketplace: 1500, teacher_link: 500 })).toContain('a Reforce fica com 5% da aula');
  });
});
