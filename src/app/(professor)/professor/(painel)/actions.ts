'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { setDisplayName, updateTeacherProfile, type Specialty } from '@/domain/teachers/profile';
import { submitVerificationDocument, type VerificationKind } from '@/domain/teachers/verification';
import { submitTeacherPhoto } from '@/domain/teachers/photo';
import { openPaymentAccount } from '@/domain/teachers/payment-account';
import { submitForReview } from '@/domain/teachers/review';
import { appDeps, now } from '@/server/app';
import { errorMessage, type ActionState } from '@/server/action-result';
import { requireTeacher } from '@/server/session';

const s = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

export async function saveProfileAction(_: unknown, f: FormData): Promise<ActionState> {
  const teacherId = await requireTeacher();
  try {
    const radius = s(f, 'travelRadiusKm');
    await updateTeacherProfile(appDeps(), teacherId, {
      displayName: s(f, 'displayName'),
      slug: s(f, 'slug'),
      headline: s(f, 'headline'),
      bio: s(f, 'bio'),
      timezone: s(f, 'timezone'),
      phone: s(f, 'phone'),
      whatsappOptIn: f.get('whatsappOptIn') === 'on',
      baseCep: s(f, 'baseCep'),
      travelRadiusKm: radius ? Number(radius.replace(',', '.')) : null,
      teachingAddress: s(f, 'teachingAddress'),
      subjects: f.getAll('subj').map((v) => String(v).split(':').map(Number) as [number, number]),
      specialties: f.getAll('specialty').map(String) as Specialty[],
      teachingSince: s(f, 'teachingSince') ? Number(s(f, 'teachingSince')) : null,
    }, await now());
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  revalidatePath('/professor');
  return { ok: true, data: undefined };
}

export async function uploadDocumentAction(_: unknown, f: FormData): Promise<ActionState> {
  const teacherId = await requireTeacher();
  try {
    const files = await Promise.all(
      f.getAll('files').filter((x): x is File => x instanceof File && x.size > 0).map(async (file) => ({
        name: file.name, contentType: file.type, bytes: new Uint8Array(await file.arrayBuffer()),
      })),
    );
    await submitVerificationDocument(appDeps(), teacherId, { kind: s(f, 'kind') as VerificationKind, files }, await now());
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  revalidatePath('/professor/verificacao');
  return { ok: true, data: undefined };
}

export async function openAccountAction(_: unknown, f: FormData): Promise<ActionState> {
  const teacherId = await requireTeacher();
  try {
    await openPaymentAccount(appDeps(), teacherId, {
      name: s(f, 'name'), email: s(f, 'email'), cpfCnpj: s(f, 'cpfCnpj'), birthDate: s(f, 'birthDate'),
      phone: s(f, 'phone'), postalCode: s(f, 'postalCode'), address: s(f, 'address'),
      addressNumber: s(f, 'addressNumber'), province: s(f, 'province'),
      incomeValueCents: Math.round(Number(s(f, 'income').replace(/\./g, '').replace(',', '.')) * 100),
    }, await now());
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  revalidatePath('/professor/recebimento');
  return { ok: true, data: undefined };
}

export async function submitForReviewAction(_: unknown, _f: FormData): Promise<ActionState> {
  const teacherId = await requireTeacher();
  try {
    await submitForReview(appDeps(), teacherId, await now());
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  revalidatePath('/professor');
  return { ok: true, data: undefined };
}

export async function uploadPhotoAction(_: unknown, f: FormData): Promise<ActionState> {
  const teacherId = await requireTeacher();
  try {
    const file = f.get('photo');
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'escolha uma foto' };
    await submitTeacherPhoto(appDeps(), teacherId, {
      name: file.name, contentType: file.type, bytes: new Uint8Array(await file.arrayBuffer()),
    }, await now());
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  revalidatePath('/professor/cadastro');
  return { ok: true, data: undefined };
}

/** Boas-vindas (primeiro acesso): grava o nome e leva ao Início com os passos. */
export async function saveNameAction(_: unknown, f: FormData): Promise<ActionState> {
  const teacherId = await requireTeacher();
  try {
    await setDisplayName(appDeps(), teacherId, s(f, 'nome'));
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  revalidatePath('/professor', 'layout');
  redirect('/professor');
}
