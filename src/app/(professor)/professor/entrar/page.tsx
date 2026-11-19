import Link from 'next/link';
import { CodeLogin } from '@/components/CodeLogin';
import { finishAction, startAction } from './actions';

export const dynamic = 'force-dynamic';

export default function TeacherLoginPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-5 py-10">
      <Link href="/" className="font-display text-2xl font-bold">Reforce</Link>
      <div className="space-y-1.5">
        <h1 className="font-display text-3xl font-bold">Área do professor</h1>
        <p className="text-[15px] leading-relaxed text-site-muted">
          Entre com seu e-mail: mandamos um código, sem senha. Se for o primeiro acesso, o cadastro começa por aqui.
        </p>
      </div>
      <CodeLogin start={startAction} finish={finishAction} emailLabel="Seu e-mail" />
    </main>
  );
}
