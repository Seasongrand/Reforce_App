/**
 * Configuração da aplicação, lida do ambiente e validada na inicialização.
 * Valores que a especificação marca como sugestão ou hipótese têm o valor
 * sugerido como padrão e estão listados em docs/pendencias.md.
 */
import { z } from 'zod';

type Env = Record<string, string | undefined>;

const PROVIDER_KEYS = [
  'PAYMENT_PROVIDER', 'VIDEO_PROVIDER', 'WHATSAPP_PROVIDER', 'EMAIL_PROVIDER', 'CALENDAR_PROVIDER', 'GEOCODING_PROVIDER',
] as const;

const int = (def: number, min: number, max: number) => z.coerce.number().int().min(min).max(max).default(def);

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'deve ser uma URL postgres://'),
    APP_BASE_URL: z.string().regex(/^https?:\/\//, 'deve ser uma URL http(s)://').default('http://localhost:3000'),
    // 'lista_de_espera': só a página inicial com a lista de professores; o marketplace fica desligado
    SITE_MODE: z.enum(['completo', 'lista_de_espera']).default('completo'),
    // obrigatórios no site completo (sessões e documentos); dispensáveis na lista de espera
    SESSION_SECRET: z.string().min(32, 'deve ter pelo menos 32 caracteres').optional(),
    DEV_TOOLS: z.enum(['0', '1']).default('0'),
    // §2.4: reserva temporária de 10 minutos; QR do PIX expira 1 minuto antes
    HOLD_MINUTES: int(10, 1, 60),
    PIX_EXPIRY_LEAD_MINUTES: int(1, 0, 59),
    // Resumo executivo: 15% busca, 5% link do professor (hipóteses)
    COMMISSION_MARKETPLACE_BPS: int(1500, 0, 10_000),
    COMMISSION_TEACHER_LINK_BPS: int(500, 0, 10_000),
    // §1: prazos sugeridos; a contestação caiu de 24 h para 2 h em 27/11 (dono), para o PIX chegar antes ao professor
    DISPUTE_WINDOW_HOURS: int(2, 0, 24 * 30),
    TEACHER_NO_SHOW_MINUTES: int(15, 1, 240),
    // §3.7: renovar a certidão a cada 6 meses
    CRIMINAL_RECORD_VALIDITY_MONTHS: int(6, 1, 24),
    // §2.4: livre/ocupado com limite de 2 segundos
    CALENDAR_FREEBUSY_TIMEOUT_MS: int(2000, 100, 30_000),
    // Decisões de 16/11/2026: falta do aluno paga 100% ao professor; piso começa em 0
    STUDENT_NO_SHOW_TEACHER_PCT: int(100, 0, 100),
    PRICE_FLOOR_CENTS: int(0, 0, 10_000_000),
    // Provedores (§3): 'fake' até as credenciais reais chegarem
    PAYMENT_PROVIDER: z.enum(['fake', 'asaas']).default('fake'),
    // Asaas: chave e token do webhook só em variáveis de ambiente
    ASAAS_API_KEY: z.string().min(10).optional(),
    ASAAS_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
    ASAAS_WEBHOOK_TOKEN: z.string().min(32, 'deve ter pelo menos 32 caracteres').optional(),
    // retenção padrão da Conta Escrow: o máximo do Asaas (45 dias), acima da agenda de 42 dias mais a contestação
    ASAAS_ESCROW_DAYS: int(45, 1, 45),
    VIDEO_PROVIDER: z.enum(['fake', 'daily']).default('fake'),
    // Daily: chave e segredo do webhook (base64) só em variáveis de ambiente; o subdomínio da conta
    DAILY_API_KEY: z.string().min(10).optional(),
    DAILY_DOMAIN: z.string().regex(/^[a-z0-9-]+$/, 'só o subdomínio, por exemplo reforce').optional(),
    DAILY_WEBHOOK_SECRET: z.string().regex(/^[A-Za-z0-9+/]{32,}={0,2}$/, 'segredo em base64 (32 bytes ou mais)').optional(),
    WHATSAPP_PROVIDER: z.enum(['fake', 'meta']).default('fake'),
    EMAIL_PROVIDER: z.enum(['fake', 'resend']).default('fake'),
    // Resend: a chave só em variável de ambiente; o remetente num domínio verificado lá
    RESEND_API_KEY: z.string().min(10).optional(),
    EMAIL_FROM: z.string().min(3).default('Reforce <avisos@reforce.app.br>'),
    CALENDAR_PROVIDER: z.enum(['fake', 'google']).default('fake'),
    GEOCODING_PROVIDER: z.enum(['fake']).default('fake'),
    // Documentos de verificação: cifrados em disco (AES-256-GCM), fora do banco
    FILE_ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, 'deve ter 64 caracteres hexadecimais (32 bytes)').optional(),
    FILE_STORAGE_DIR: z.string().default('var/private'),
    // Só para os adaptadores falsos
    FAKE_WEBHOOK_SECRET: z.string().min(16).default('segredo-dos-webhooks-falsos-dev'),
    FAKE_FAIL: z.string().default(''),
    // Exportação da lista de espera (CSV), protegida por senha; sem senha, a exportação não existe
    WAITLIST_EXPORT_PASSWORD: z.string().min(16, 'deve ter pelo menos 16 caracteres').optional(),
    // Identificação da empresa nas páginas de termos e privacidade (Decreto 7.962/2013); sem elas, a página omite a linha
    COMPANY_LEGAL_NAME: z.string().min(3).optional(),
    COMPANY_CNPJ: z.string().regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, 'CNPJ no formato 00.000.000/0000-00').optional(),
    COMPANY_ADDRESS: z.string().min(10).optional(),
    CONTACT_EMAIL: z.string().regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, 'e-mail inválido').default('ola.reforce@gmail.com'),
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
    if (e.PAYMENT_PROVIDER === 'asaas') {
      for (const k of ['ASAAS_API_KEY', 'ASAAS_WEBHOOK_TOKEN'] as const) {
        if (!e[k]) ctx.addIssue({ code: 'custom', path: [k], message: 'obrigatório com PAYMENT_PROVIDER=asaas' });
      }
    }
    if (e.VIDEO_PROVIDER === 'daily') {
      for (const k of ['DAILY_API_KEY', 'DAILY_DOMAIN', 'DAILY_WEBHOOK_SECRET'] as const) {
        if (!e[k]) ctx.addIssue({ code: 'custom', path: [k], message: 'obrigatório com VIDEO_PROVIDER=daily' });
      }
    }
    if (e.EMAIL_PROVIDER === 'resend' && !e.RESEND_API_KEY) {
      ctx.addIssue({ code: 'custom', path: ['RESEND_API_KEY'], message: 'obrigatório com EMAIL_PROVIDER=resend' });
    }
    if (e.SITE_MODE === 'completo') {
      if (!e.SESSION_SECRET) ctx.addIssue({ code: 'custom', path: ['SESSION_SECRET'], message: 'obrigatório no site completo' });
      if (!e.FILE_ENCRYPTION_KEY) {
        ctx.addIssue({ code: 'custom', path: ['FILE_ENCRYPTION_KEY'], message: 'obrigatório no site completo' });
      }
    }
    // a lista de espera não usa pagamento, vídeo nem mensagens: adaptador falso não chega a ser chamado
    if (e.NODE_ENV === 'production' && e.SITE_MODE === 'completo') {
      for (const k of PROVIDER_KEYS) {
        if (e[k] === 'fake') ctx.addIssue({ code: 'custom', path: [k], message: 'adaptador falso não pode rodar em produção' });
      }
    }
  });

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  siteMode: 'completo' | 'lista_de_espera';
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
  providers: {
    payment: 'fake' | 'asaas';
    video: 'fake' | 'daily';
    whatsapp: 'fake' | 'meta';
    email: 'fake' | 'resend';
    calendar: 'fake' | 'google';
    geocoding: 'fake';
  };
  fileEncryptionKeyHex: string;
  fileStorageDir: string;
  fakeWebhookSecret: string;
  /** Operações em que os adaptadores falsos simulam falha (ex.: releaseEscrow,freeBusy). */
  fakeFail: string[];
  waitlistExportPassword: string | null;
  contactEmail: string;
  /** Nome empresarial, CNPJ e endereço, quando configurados. */
  company: { legalName: string | null; cnpj: string | null; address: string | null };
  /** Envio de e-mail pelo Resend (só com EMAIL_PROVIDER=resend). */
  email: { resendApiKey: string; from: string };
  /** Sala de vídeo pelo Daily (só com VIDEO_PROVIDER=daily). */
  daily: { apiKey: string; domain: string; webhookSecret: string };
  /** Pagamento pelo Asaas (só com PAYMENT_PROVIDER=asaas). */
  asaas: { apiKey: string; env: 'sandbox' | 'production'; webhookToken: string; escrowDays: number };
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
    siteMode: e.SITE_MODE,
    databaseUrl: e.DATABASE_URL,
    appBaseUrl: e.APP_BASE_URL.replace(/\/$/, ''),
    sessionSecret: e.SESSION_SECRET ?? '',
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
    providers: {
      payment: e.PAYMENT_PROVIDER,
      video: e.VIDEO_PROVIDER,
      whatsapp: e.WHATSAPP_PROVIDER,
      email: e.EMAIL_PROVIDER,
      calendar: e.CALENDAR_PROVIDER,
      geocoding: e.GEOCODING_PROVIDER,
    },
    fileEncryptionKeyHex: e.FILE_ENCRYPTION_KEY ?? '',
    fileStorageDir: e.FILE_STORAGE_DIR,
    fakeWebhookSecret: e.FAKE_WEBHOOK_SECRET,
    fakeFail: e.FAKE_FAIL.split(',').map((x) => x.trim()).filter(Boolean),
    waitlistExportPassword: e.WAITLIST_EXPORT_PASSWORD ?? null,
    contactEmail: e.CONTACT_EMAIL,
    company: { legalName: e.COMPANY_LEGAL_NAME ?? null, cnpj: e.COMPANY_CNPJ ?? null, address: e.COMPANY_ADDRESS ?? null },
    email: { resendApiKey: e.RESEND_API_KEY ?? '', from: e.EMAIL_FROM },
    daily: { apiKey: e.DAILY_API_KEY ?? '', domain: e.DAILY_DOMAIN ?? '', webhookSecret: e.DAILY_WEBHOOK_SECRET ?? '' },
    asaas: { apiKey: e.ASAAS_API_KEY ?? '', env: e.ASAAS_ENV, webhookToken: e.ASAAS_WEBHOOK_TOKEN ?? '', escrowDays: e.ASAAS_ESCROW_DAYS },
  };
}

/**
 * O marketplace (sessões e documentos) pode rodar? No site completo, sempre
 * (a validação exige as duas chaves). Na lista de espera, só quando as duas
 * foram definidas: aí a equipe, com a senha, usa as áreas fechadas ao público.
 */
export function marketplaceReady(cfg: AppConfig): boolean {
  return Boolean(cfg.sessionSecret && cfg.fileEncryptionKeyHex);
}

let cached: AppConfig | undefined;

/** Configuração do processo, lida uma vez de process.env. */
export function config(): AppConfig {
  cached ??= loadConfig(process.env);
  return cached;
}
