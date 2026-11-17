import { notFound, redirect } from 'next/navigation';
import { orderView } from '@/domain/public/order';
import { loadMessageContext } from '@/domain/notifications/templates';
import { formatBRL } from '@/lib/money';
import { bothTimes } from '@/time/zoned';
import { appDeps, now } from '@/server/app';
import { currentSubject } from '@/server/session';

export const dynamic = 'force-dynamic';

export default async function ConfirmedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guardianId = await currentSubject('guardian');
  if (!guardianId) notFound();
  const deps = appDeps();
  const v = await orderView(deps, id, guardianId, await now());
  if (!v) notFound();
  if (v.status !== 'paid') redirect(`/pedido/${id}`);
  const c = await loadMessageContext(deps, v.bookingId);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold" data-testid="aula-confirmada">Aula confirmada</h1>
      <div className="card space-y-2 text-sm">
        <p>Aula de <strong>{c.subject}</strong> de {c.student.firstName} com {c.teacher.name}.</p>
        <p className="text-base font-medium">{bothTimes(c.startsAt, c.teacher.timezone, c.guardian.timezone)}</p>
        <p>{formatBRL(c.totalCents)}, pago.</p>
      </div>
      <div className="card space-y-2 text-sm">
        {c.modality === 'online' && (
          <>
            <p>A aula é online, na sala da plataforma. Ela abre 10 minutos antes.</p>
            <a className="btn" href={c.links.lesson}>Página da aula</a>
          </>
        )}
        {c.modality !== 'online' && (
          <>
            {c.modality === 'at_teacher'
              ? <p>Endereço: <strong>{c.teacher.teachingAddress}</strong></p>
              : <p>O professor vai até o seu endereço: {c.familyAddress}. Um adulto deve estar em casa na primeira aula.</p>}
            <p>Código da aula, para informar ao professor na chegada: <strong className="text-lg tracking-widest" data-testid="codigo">{c.checkinCode}</strong></p>
          </>
        )}
      </div>
      <p className="text-sm text-slate-600">
        Você recebeu a confirmação por e-mail{c.guardian.phone ? ' e pelo WhatsApp' : ''}. Lembretes chegam 24 horas e 1 hora antes.
      </p>
    </div>
  );
}
