/**
 * Configuração da aplicação, lida do ambiente e validada na inicialização.
 * Valores que a especificação marca como sugestão ou hipótese têm o valor
 * sugerido como padrão e estão listados em docs/pendencias.md.
 */
import { z } from 'zod';

type Env = Record<string, string | undefined>;

const int = (def: number, min: number, max: number) => z.coerce.number().int().min(min).max(max).default(def);

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'deve ser uma URL postgres://'),
    APP_BASE_URL: z.string().regex(/^https?:\/\//, 'deve ser uma URL http(s)://').default('http://localhost:3000'),
    SESSION_SECRET: z.string().min(32, 'deve ter pelo menos 32 caracteres'),
    DEV_TOOLS: z.enum(['0', '1']).default('0'),
    // §2.4: reserva temporária de 10 minutos; QR do PIX expira 1 minuto antes
    HOLD_MINUTES: int(10, 1, 60),
    PIX_EXPIRY_LEAD_MINUTES: int(1, 0, 59),
    // Resumo executivo: 15% busca, 5% link do professor (hipóteses)
    COMMISSION_MARKETPLACE_BPS: int(1500, 0, 10_000),
    COMMISSION_TEACHER_LINK_BPS: int(500, 0, 10_000),
    // §1: prazos de 24 h e 15 min são sugestões
    DISPUTE_WINDOW_HOURS: int(24, 0, 24 * 30),
    TEACHER_NO_SHOW_MINUTES: int(15, 1, 240),
    // §3.7: renovar a certidão a cada 6 meses
    CRIMINAL_RECORD_VALIDITY_MONTHS: int(6, 1, 24),
    // §2.4: livre/ocupado com limite de 2 segundos
    CALENDAR_FREEBUSY_TIMEOUT_MS: int(2000, 100, 30_000),
    // Decisões de 16/11/2026: falta do aluno paga 100% ao professor; piso começa em 0
    STUDENT_NO_SHOW_TEACHER_PCT: int(100, 0, 100),
    PRICE_FLOOR_CENTS: int(0, 0, 10_000_000),
  })
  .superRefine((e, ctx) => {
    if (e.PIX_EXPIRY_LEAD_MINUTES >= e.HOLD_MINUTES) {
      ctx.addIssue({
        code: 'custom',
        path: ['PIX_EXPIRY_LEAD_MINUTES'],
        message: 'deve ser menor que HOLD_MINUTES',
      });
    }
    if (e.NODE_ENV === 'production' && e.DEV_TOOLS === '1') {
      ctx.addIssue({ code: 'custom', path: ['DEV_TOOLS'], message: 'não pode ser 1 em produção' });
    }
  });

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  databaseUrl: string;
  appBaseUrl: string;
  sessionSecret: string;
  devTools: boolean;
  holdMinutes: number;
  pixExpiryLeadMinutes: number;
  commissionBps: { marketplace: number; teacher_link: number };
  disputeWindowHours: number;
  teacherNoShowMinutes: number;
  criminalRecordValidityMonths: number;
  calendarFreeBusyTimeoutMs: number;
  studentNoShowTeacherPct: number;
  priceFloorCents: number;
}

export function loadConfig(env: Env): AppConfig {
  // variável definida mas vazia conta como ausente
  const clean = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v !== ''));
  const parsed = schema.safeParse(clean);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `${i.path.join('.') || '(raiz)'}: ${i.message}`);
    throw new Error(`Configuração inválida:\n  ${lines.join('\n  ')}`);
  }
  const e = parsed.data;
  return {
    nodeEnv: e.NODE_ENV,
    databaseUrl: e.DATABASE_URL,
    appBaseUrl: e.APP_BASE_URL.replace(/\/$/, ''),
    sessionSecret: e.SESSION_SECRET,
    devTools: e.DEV_TOOLS === '1',
    holdMinutes: e.HOLD_MINUTES,
    pixExpiryLeadMinutes: e.PIX_EXPIRY_LEAD_MINUTES,
    commissionBps: { marketplace: e.COMMISSION_MARKETPLACE_BPS, teacher_link: e.COMMISSION_TEACHER_LINK_BPS },
    disputeWindowHours: e.DISPUTE_WINDOW_HOURS,
    teacherNoShowMinutes: e.TEACHER_NO_SHOW_MINUTES,
    criminalRecordValidityMonths: e.CRIMINAL_RECORD_VALIDITY_MONTHS,
    calendarFreeBusyTimeoutMs: e.CALENDAR_FREEBUSY_TIMEOUT_MS,
    studentNoShowTeacherPct: e.STUDENT_NO_SHOW_TEACHER_PCT,
    priceFloorCents: e.PRICE_FLOOR_CENTS,
  };
}

let cached: AppConfig | undefined;

/** Configuração do processo, lida uma vez de process.env. */
export function config(): AppConfig {
  cached ??= loadConfig(process.env);
  return cached;
}
