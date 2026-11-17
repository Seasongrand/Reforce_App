import Link from 'next/link';
import { ActionForm } from '@/components/ActionForm';
import { appDeps } from '@/server/app';
import { requireTeacher } from '@/server/session';
import { openAccountAction } from '../actions';

export const dynamic = 'force-dynamic';

const field = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
  <div>
    <label className="label" htmlFor={name}>{label}</label>
    <input className="input" id={name} name={name} required {...props} />
  </div>
);

export default async function PayoutAccountPage() {
  const teacherId = await requireTeacher();
  const acc = await appDeps().db.selectFrom('teacher_payment_accounts').select(['status', 'created_at'])
    .where('teacher_id', '=', teacherId).executeTakeFirst();
  return (
    <div className="space-y-6">
      <Link href="/professor" className="text-sm text-brand">← Painel</Link>
      <h1 className="text-2xl font-semibold">Conta de recebimento</h1>
      <p className="text-sm text-slate-700">
        O aluno paga na plataforma. Sua parte fica retida no provedor de pagamento e é liberada na sua conta
        24 horas depois da aula, se ninguém contestar. Seus dados vão direto ao provedor; a plataforma não guarda seu CPF.
      </p>
      {acc && acc.status !== 'rejected' ? (
        <p className="notice" data-testid="conta-status">
          Conta {acc.status === 'active' ? 'ativa' : 'em análise no provedor'}.
        </p>
      ) : (
        <ActionForm action={openAccountAction} submitLabel="Abrir conta" successMessage="Conta aberta.">
          {field('name', 'Nome completo do titular')}
          {field('cpfCnpj', 'CPF ou CNPJ', { inputMode: 'numeric' })}
          {field('birthDate', 'Data de nascimento', { type: 'date' })}
          {field('email', 'E-mail', { type: 'email' })}
          {field('phone', 'Celular')}
          <div className="grid gap-4 sm:grid-cols-3">
            {field('postalCode', 'CEP', { inputMode: 'numeric' })}
            {field('address', 'Endereço')}
            {field('addressNumber', 'Número')}
          </div>
          <div>
            <label className="label" htmlFor="province">Bairro</label>
            <input className="input" id="province" name="province" />
          </div>
          {field('income', 'Renda mensal aproximada (R$)', { inputMode: 'decimal' })}
        </ActionForm>
      )}
    </div>
  );
}
