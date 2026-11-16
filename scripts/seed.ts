/**
 * Carga inicial idempotente: catálogo fechado de disciplinas e séries
 * (src/domain/catalog.ts) e a equipe do painel interno (ADMIN_EMAILS).
 * Rode com `npm run db:seed`.
 */
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { GRADE_LEVELS, SUBJECTS } from '../src/domain/catalog';

function parseAdmins(list: string): Array<{ email: string; name: string }> {
  return list
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const m = /^(.*)<([^>]+)>$/.exec(entry);
      const email = (m ? m[2]! : entry).trim().toLowerCase();
      const name = (m ? m[1]!.trim() : '') || email.split('@')[0]!;
      return { email, name };
    });
}

export async function seed(databaseUrl: string, opts: { adminEmails?: string } = {}): Promise<void> {
  const c = new pg.Client({ connectionString: databaseUrl });
  await c.connect();
  try {
    await c.query('BEGIN');
    for (const s of SUBJECTS) {
      await c.query(
        `INSERT INTO subjects (id, slug, name) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, name = EXCLUDED.name`,
        [s.id, s.slug, s.name],
      );
    }
    for (const g of GRADE_LEVELS) {
      await c.query(
        `INSERT INTO grade_levels (id, slug, name, stage) VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, name = EXCLUDED.name, stage = EXCLUDED.stage`,
        [g.id, g.slug, g.name, g.stage],
      );
    }
    for (const a of parseAdmins(opts.adminEmails ?? '')) {
      await c.query(`INSERT INTO staff_users (email, name) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING`, [a.email, a.name]);
    }
    await c.query('COMMIT');
  } catch (err) {
    await c.query('ROLLBACK');
    throw err;
  } finally {
    await c.end();
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL não definida (veja .env.example)');
    process.exit(1);
  }
  seed(url, { adminEmails: process.env.ADMIN_EMAILS })
    .then(() => console.log('carga inicial aplicada'))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
