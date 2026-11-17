import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AlunoCodeLogin } from '@/components/aluno/AlunoCodeLogin';
import { TITLE } from '@/components/aluno/ui';
import { currentSubject } from '@/server/session';
import { finishAction, startAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Entrar · Reforce' };

export default async function GuardianLoginPage() {
  if (await currentSubject('guardian')) redirect('/conta');
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <h1 className={TITLE}>Minha conta</h1>
        <p className="text-[15px] leading-normal text-site-muted">
          Para o adulto responsável que reservou as aulas. Sem senha: mandamos um código para o seu e-mail.
        </p>
      </div>
      <AlunoCodeLogin start={startAction} finish={finishAction} />
    </div>
  );
}
