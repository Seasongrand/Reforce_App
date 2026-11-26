/** Envio de e-mail pelo Resend: o pedido certo à API e erro claro quando ela recusa. */
import { describe, expect, it } from 'vitest';
import { loadConfig } from '@/config';
import { ResendEmailSender } from '@/providers/email/resend';

const base = {
  DATABASE_URL: 'postgres://u:p@localhost:5433/aulas', APP_BASE_URL: 'http://localhost:3000',
  SESSION_SECRET: 's'.repeat(32), FILE_ENCRYPTION_KEY: 'a'.repeat(64),
};

describe('ResendEmailSender', () => {
  it('manda remetente, destinatário, assunto, texto e responder-para; devolve o id do Resend', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: 'em_123' }), { status: 200 });
    }) as unknown as typeof fetch;
    const s = new ResendEmailSender({ apiKey: 're_teste_123', from: 'Reforce <avisos@reforce.app.br>', replyTo: 'ola@reforce.app.br', fetch: fakeFetch });
    expect(await s.send({ to: 'maria@exemplo.com', subject: 'Oi', text: 'Texto' })).toEqual({ providerMessageId: 'em_123' });
    expect(calls[0]!.url).toBe('https://api.resend.com/emails');
    expect((calls[0]!.init.headers as Record<string, string>).authorization).toBe('Bearer re_teste_123');
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({
      from: 'Reforce <avisos@reforce.app.br>', to: ['maria@exemplo.com'], subject: 'Oi', text: 'Texto', reply_to: 'ola@reforce.app.br',
    });
  });

  it('erro da API vira exceção com o motivo (a varredura marca a mensagem como falha)', async () => {
    const fakeFetch = (async () => new Response(JSON.stringify({ message: 'domain not verified' }), { status: 403 })) as unknown as typeof fetch;
    const s = new ResendEmailSender({ apiKey: 'k'.repeat(12), from: 'x@y.z', fetch: fakeFetch });
    await expect(s.send({ to: 'a@b.c', subject: 's', text: 't' })).rejects.toThrow(/403.*domain not verified/);
  });
});

describe('configuração do e-mail', () => {
  it('EMAIL_PROVIDER=resend exige RESEND_API_KEY; o remetente padrão é do domínio da Reforce', () => {
    expect(() => loadConfig({ ...base, EMAIL_PROVIDER: 'resend' })).toThrow(/RESEND_API_KEY/);
    const c = loadConfig({ ...base, EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 're_teste_123' });
    expect(c.providers.email).toBe('resend');
    expect(c.email).toEqual({ resendApiKey: 're_teste_123', from: 'Reforce <avisos@reforce.app.br>' });
  });
});
