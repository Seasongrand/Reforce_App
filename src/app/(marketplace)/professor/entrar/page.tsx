import { CodeLogin } from '@/components/CodeLogin';
import { finishAction, startAction } from './actions';

export const dynamic = 'force-dynamic';

export default function TeacherLoginPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Área do professor</h1>
      <p className="text-slate-700">Entre com seu e-mail. Se for o primeiro acesso, o cadastro começa por aqui.</p>
      <CodeLogin start={startAction} finish={finishAction} emailLabel="Seu e-mail" />
    </div>
  );
}
