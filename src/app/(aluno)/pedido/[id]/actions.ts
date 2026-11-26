'use server';

import { revalidatePath } from 'next/cache';
import { startPayment } from '@/domain/payment/charge';
import { appDeps, now } from '@/server/app';
import { errorMessage, type ActionState } from '@/server/action-result';
import { currentSubject } from '@/server/session';

export async function startPaymentAction(_: unknown, f: FormData): Promise<ActionState> {
  const guardianId = await currentSubject('guardian');
  if (!guardianId) return { ok: false, error: 'Sua sessão expirou.' };
  const orderId = String(f.get('orderId') ?? '');
  try {
    await startPayment(appDeps(), {
      orderId, guardianId, method: f.get('method') === 'card' ? 'card' : 'pix', payerCpf: String(f.get('payerCpf') ?? '') || undefined,
    }, await now());
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  revalidatePath(`/pedido/${orderId}`);
  return { ok: true, data: undefined };
}
