/**
 * Escolhe os adaptadores pela configuração. Os reais (Asaas, vídeo, WhatsApp
 * Cloud API, SES, Google Calendar) entram quando as credenciais chegarem;
 * até lá, escolhê-los falha com mensagem clara.
 */
import type { AppConfig } from '@/config';
import type { Db } from '@/db/client';
import { ProviderNotConfiguredError } from './errors';
import { FakeCalendarProvider } from './calendar/fake';
import type { CalendarProvider } from './calendar/types';
import { FakeEmailSender } from './email/fake';
import { ResendEmailSender } from './email/resend';
import { DailyVideoProvider } from './video/daily';
import type { EmailSender } from './email/types';
import { FakeGeocoder } from './geocoding/fake';
import type { Geocoder } from './geocoding/types';
import { FakePaymentProvider } from './payment/fake';
import type { PaymentProvider } from './payment/types';
import { LocalEncryptedStorage } from './storage/local';
import type { FileStorage } from './storage/types';
import { FakeVideoProvider } from './video/fake';
import type { VideoProvider } from './video/types';
import { FakeWhatsAppSender } from './whatsapp/fake';
import type { WhatsAppSender } from './whatsapp/types';

export interface Providers {
  payment: PaymentProvider;
  video: VideoProvider;
  whatsapp: WhatsAppSender;
  email: EmailSender;
  calendar: CalendarProvider;
  storage: FileStorage;
  geocoder: Geocoder;
}

const notYet = (what: string, env: string) =>
  new ProviderNotConfiguredError(
    `Adaptador ${what} ainda não implementado: aguardando credenciais (${env}). Veja docs/pendencias.md.`,
  );

export function providers(db: Db, cfg: AppConfig): Providers {
  const fakeOpts = { webhookSecret: cfg.fakeWebhookSecret, appBaseUrl: cfg.appBaseUrl, failOn: cfg.fakeFail };
  const p = cfg.providers;
  if (p.payment !== 'fake') throw notYet('Asaas', 'PAYMENT_PROVIDER');
  if (p.whatsapp !== 'fake') throw notYet('WhatsApp Cloud API', 'WHATSAPP_PROVIDER');
  if (p.calendar !== 'fake') throw notYet('Google Calendar', 'CALENDAR_PROVIDER');
  return {
    payment: new FakePaymentProvider(db, fakeOpts),
    video: p.video === 'daily' ? new DailyVideoProvider(cfg.daily) : new FakeVideoProvider(db, fakeOpts),
    whatsapp: new FakeWhatsAppSender(db),
    email: p.email === 'resend'
      ? new ResendEmailSender({ apiKey: cfg.email.resendApiKey, from: cfg.email.from, replyTo: cfg.contactEmail })
      : new FakeEmailSender(db),
    calendar: new FakeCalendarProvider(db, { failOn: cfg.fakeFail }),
    storage: new LocalEncryptedStorage({
      dir: cfg.fileStorageDir,
      keyHex: cfg.fileEncryptionKeyHex,
      signingSecret: cfg.sessionSecret,
      baseUrl: cfg.appBaseUrl,
    }),
    geocoder: new FakeGeocoder(),
  };
}
