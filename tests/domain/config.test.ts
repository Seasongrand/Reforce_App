import { describe, expect, it } from 'vitest';
import { loadConfig } from '@/config';

const base = {
  DATABASE_URL: 'postgres://u:p@localhost:5433/aulas',
  APP_BASE_URL: 'http://localhost:3000',
  SESSION_SECRET: 's'.repeat(32),
};

describe('configuração', () => {
  it('aplica os valores sugeridos pela especificação quando não informados', () => {
    const c = loadConfig(base);
    expect(c.holdMinutes).toBe(10);
    expect(c.pixExpiryLeadMinutes).toBe(1);
    expect(c.commissionBps).toEqual({ marketplace: 1500, teacher_link: 500 });
    expect(c.disputeWindowHours).toBe(24);
    expect(c.teacherNoShowMinutes).toBe(15);
    expect(c.criminalRecordValidityMonths).toBe(6);
    expect(c.calendarFreeBusyTimeoutMs).toBe(2000);
    expect(c.studentNoShowTeacherPct).toBe(100);
    expect(c.priceFloorCents).toBe(0);
    expect(c.devTools).toBe(false);
  });

  it('lê valores do ambiente', () => {
    const c = loadConfig({ ...base, HOLD_MINUTES: '15', COMMISSION_MARKETPLACE_BPS: '1800', DEV_TOOLS: '1' });
    expect(c.holdMinutes).toBe(15);
    expect(c.commissionBps.marketplace).toBe(1800);
    expect(c.devTools).toBe(true);
  });

  it('falha na inicialização se faltar variável obrigatória', () => {
    expect(() => loadConfig({ ...base, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/);
    expect(() => loadConfig({ ...base, SESSION_SECRET: 'curto' })).toThrow(/SESSION_SECRET/);
  });

  it('recusa valores incoerentes', () => {
    expect(() => loadConfig({ ...base, HOLD_MINUTES: '0' })).toThrow(/HOLD_MINUTES/);
    expect(() => loadConfig({ ...base, PIX_EXPIRY_LEAD_MINUTES: '10' })).toThrow(/PIX_EXPIRY_LEAD_MINUTES/);
    expect(() => loadConfig({ ...base, COMMISSION_MARKETPLACE_BPS: '10001' })).toThrow(/COMMISSION_MARKETPLACE_BPS/);
  });

  it('não sobe em produção com as ferramentas de desenvolvimento ligadas', () => {
    expect(() => loadConfig({ ...base, NODE_ENV: 'production', DEV_TOOLS: '1' })).toThrow(/DEV_TOOLS/);
  });
});
