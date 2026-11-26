/**
 * E-mail transacional pelo Resend (API HTTP). A chave fica só em variável de
 * ambiente (RESEND_API_KEY); o remetente em EMAIL_FROM, num domínio verificado
 * no Resend. Respostas vão para CONTACT_EMAIL.
 */
import type { EmailSender } from './types';

export class ResendEmailSender implements EmailSender {
  readonly name = 'resend';
  constructor(
    private readonly opts: { apiKey: string; from: string; replyTo?: string; fetch?: typeof fetch },
  ) {}

  async send(msg: { to: string; subject: string; text: string }) {
    const res = await (this.opts.fetch ?? fetch)('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${this.opts.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: this.opts.from,
        to: [msg.to],
        subject: msg.subject,
        text: msg.text,
        ...(this.opts.replyTo ? { reply_to: this.opts.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok || !body.id) throw new Error(`Resend recusou o e-mail (${res.status}): ${body.message ?? 'sem detalhe'}`);
    return { providerMessageId: body.id };
  }
}
