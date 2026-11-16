/** E-mail transacional (§3.2): cópia de toda mensagem enviada por WhatsApp. */
export interface EmailSender {
  readonly name: string;
  send(msg: { to: string; subject: string; text: string }): Promise<{ providerMessageId: string }>;
}
