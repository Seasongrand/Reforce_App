/**
 * "Adicionar à minha agenda": arquivo de calendário da aula confirmada. Só o
 * responsável que fez o pedido (sessão) baixa, e só depois do pagamento.
 */
import { lessonIcs } from '@/domain/lessons/ics';
import { loadMessageContext } from '@/domain/notifications/templates';
import { orderView } from '@/domain/public/order';
import { appDeps, now } from '@/server/app';
import { currentSubject } from '@/server/session';

export const dynamic = 'force-dynamic';

const PLACE: Record<string, string> = {
  online: 'Online, na sala da Reforce',
  at_teacher: 'No endereço do professor',
  at_student: 'Na casa do aluno',
};

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guardianId = await currentSubject('guardian');
  if (!guardianId) return new Response('não encontrado', { status: 404 });
  const deps = appDeps();
  const at = await now();
  const v = await orderView(deps, (await ctx.params).id, guardianId, at);
  if (!v || v.status !== 'paid') return new Response('não encontrado', { status: 404 });
  const c = await loadMessageContext(deps, v.bookingId);
  const place = c.modality === 'at_teacher' && c.teacher.teachingAddress
    ? c.teacher.teachingAddress
    : c.modality === 'at_student' && c.familyAddress ? c.familyAddress : PLACE[c.modality]!;
  const body = lessonIcs({
    uid: c.bookingId,
    startsAt: c.startsAt,
    endsAt: c.startsAt.add({ minutes: c.durationMin }),
    summary: `Aula de ${v.subject} com ${c.teacher.name}`,
    description: `Aluno: ${c.student.firstName}. Página da aula: ${c.links.lesson}`,
    location: place,
    now: at,
  });
  return new Response(body, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'attachment; filename="aula-reforce.ics"',
      'cache-control': 'private, no-store',
    },
  });
}
