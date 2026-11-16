import { CodeLogin } from '@/components/CodeLogin';
import { finishAction, startAction } from './actions';

export const dynamic = 'force-dynamic';

export default function StaffLoginPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Painel interno</h1>
      <p className="text-slate-700">Acesso restrito à equipe. Se o seu e-mail tiver acesso, você recebe um código.</p>
      <CodeLogin start={startAction} finish={finishAction} emailLabel="E-mail da equipe" />
    </div>
  );
}
