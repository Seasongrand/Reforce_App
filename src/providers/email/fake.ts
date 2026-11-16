import { sql } from 'kysely';
import type { Db } from '@/db/client';
import type { EmailSender } from './types';

export class FakeEmailSender implements EmailSender {
  readonly name = 'fake';
  constructor(private readonly db: Db) {}

  async send(msg: { to: string; subject: string; text: string }) {
    const { rows } = await sql<{ id: string }>`
      INSERT INTO dev_outbox (channel, recipient, subject, body)
      VALUES ('email', ${msg.to}, ${msg.subject}, ${msg.text}) RETURNING id::text`.execute(this.db);
    return { providerMessageId: `fake_em_${rows[0]!.id}` };
  }
}
