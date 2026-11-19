/**
 * Resumo dos serviços ativos do professor para a prévia do perfil: o menor
 * preço, as durações e as modalidades, na mesma ordem da página pública.
 */
import type { Db } from '@/db/client';

export type Modality = 'online' | 'at_teacher' | 'at_student';
export const MODALITY_ORDER: Modality[] = ['online', 'at_student', 'at_teacher'];

export interface ServiceSummary {
  minPriceCents: number | null;
  durations: number[];
  modalities: Modality[];
}

export async function teacherServiceSummary(db: Db, teacherId: string): Promise<ServiceSummary> {
  const rows = await db.selectFrom('services').select(['duration_min', 'price_cents', 'modality'])
    .where('teacher_id', '=', teacherId).where('active', '=', true).execute();
  return {
    minPriceCents: rows.length > 0 ? Math.min(...rows.map((r) => r.price_cents)) : null,
    durations: [...new Set(rows.map((r) => r.duration_min))].sort((a, b) => a - b),
    modalities: MODALITY_ORDER.filter((m) => rows.some((r) => r.modality === m)),
  };
}
