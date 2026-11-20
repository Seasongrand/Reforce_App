import { CodeLogin } from '@/components/CodeLogin';
import { finishAction, startAction } from './actions';

export const dynamic = 'force-dynamic';

export default function StaffLoginPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-5 pb-10 pt-12 sm:justify-center">
      <p className="font-display text-2xl font-bold">Reforce</p>
      <div className="space-y-1.5">
        <h1 className="font-display text-3xl font-bold">Painel interno</h1>
        <p className="text-[15px] leading-relaxed text-site-muted">
          Acesso restrito à equipe. Se o seu e-mail tiver acesso, você recebe um código.
        </p>
      </div>
      <CodeLogin start={startAction} finish={finishAction} emailLabel="E-mail da equipe" />
    </main>
  );
}
