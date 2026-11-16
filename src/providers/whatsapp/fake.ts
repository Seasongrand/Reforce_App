import { sql } from 'kysely';
import type { Db } from '@/db/client';
import type { WhatsAppSender } from './types';

export class FakeWhatsAppSender implements WhatsAppSender {
  readonly name = 'fake';
  constructor(private readonly db: Db) {}

  async send(msg: { to: string; template: string; vars: Record<string, string>; preview?: string }) {
    const body = msg.preview ?? `${msg.template} ${JSON.stringify(msg.vars)}`;
    const { rows } = await sql<{ id: string }>`
      INSERT INTO dev_outbox (channel, recipient, template, body)
      VALUES ('whatsapp', ${msg.to}, ${msg.template}, ${body}) RETURNING id::text`.execute(this.db);
    return { providerMessageId: `fake_wa_${rows[0]!.id}` };
  }
}
