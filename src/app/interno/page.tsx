import { requireStaff } from '@/server/session';
import { logoutAction } from './entrar/actions';

export const dynamic = 'force-dynamic';

export default async function StaffHome() {
  await requireStaff();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Painel interno</h1>
        <form action={logoutAction}><button className="btn-secondary">Sair</button></form>
      </div>
    </div>
  );
}
