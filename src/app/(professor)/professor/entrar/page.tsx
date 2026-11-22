import Link from 'next/link';
import { CodeLogin } from '@/components/CodeLogin';
import { finishAction, startAction } from './actions';

export const dynamic = 'force-dynamic';

export default function TeacherLoginPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-5 pb-10 pt-12 sm:justify-center">
      <Link href="/" className="font-display tracking-tight text-2xl font-normal">Reforce</Link>
      <div className="space-y-1.5">
        <h1 className="font-display tracking-tight text-3xl font-normal">Área do professor</h1>
        <p className="text-[15px] leading-relaxed text-site-muted">
          Entre com seu e-mail: mandamos um código, sem senha. Se for o primeiro acesso, o cadastro começa por aqui.
        </p>
      </div>
      <CodeLogin start={startAction} finish={finishAction} emailLabel="Seu e-mail" />
      <Link href="/" className="inline-flex min-h-11 items-center text-sm font-medium text-indigo-600">← Voltar ao site</Link>
    </main>
  );
}
