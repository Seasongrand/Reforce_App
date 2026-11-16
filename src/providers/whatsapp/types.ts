/** WhatsApp Cloud API (§3.5): só modelos aprovados, de categoria utilidade. */
export interface WhatsAppSender {
  readonly name: string;
  send(msg: { to: string; template: string; vars: Record<string, string>; preview: string }): Promise<{ providerMessageId: string }>;
}
