import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SignupForm } from '@/components/aluno/SignupForm';
import { TITLE } from '@/components/aluno/ui';
import { safeReturnPath } from '@/lib/return-path';
import { currentSubject } from '@/server/session';
import { signupFinishAction, signupStartAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Criar conta · Reforce' };

/** Cadastro do adulto responsável sem precisar reservar uma aula antes. */
export default async function GuardianSignupPage({ searchParams }: { searchParams: Promise<{ voltar?: string }> }) {
  const next = safeReturnPath((await searchParams).voltar);
  if (await currentSubject('guardian')) redirect(next ?? '/conta');
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <h1 className={TITLE}>Criar conta</h1>
        <p className="text-[15px] leading-normal text-site-muted">
          Para o adulto responsável pelo aluno. Com a conta, você reserva sem preencher tudo de novo e acompanha as aulas.
        </p>
      </div>
      <SignupForm start={signupStartAction} finish={signupFinishAction} next={next} />
      <p className="text-sm text-site-muted">
        Já tem conta? <Link href={next ? `/conta/entrar?voltar=${encodeURIComponent(next)}` : '/conta/entrar'} className="inline-flex min-h-11 items-center font-medium text-indigo-600 underline">Entrar</Link>
      </p>
    </div>
  );
}
