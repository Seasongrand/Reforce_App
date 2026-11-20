import type { Metadata } from 'next';
import Link from 'next/link';
import { ActionForm } from '@/components/ActionForm';
import { EmailChange } from '@/components/aluno/EmailChange';
import { INPUT, LABEL } from '@/components/aluno/ui';
import { config } from '@/config';
import { guardianProfile } from '@/domain/guardians/profile';
import { formatPhoneBR } from '@/lib/format-br';
import { appDeps } from '@/server/app';
import { requireGuardian } from '@/server/session';
import { emailFinishAction, emailStartAction, updateProfileAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Meus dados · Minha conta · Reforce' };

const CARD = 'space-y-4 rounded-3xl border border-site-line bg-white p-5';
const SAVE = 'inline-flex min-h-11 items-center rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60';

/** Meus dados: nome e avisos por WhatsApp, troca do e-mail com código; WhatsApp e exclusão da conta pela equipe. */
export default async function GuardianData() {
  const guardianId = await requireGuardian();
  const p = await guardianProfile(appDeps().db, guardianId);
  const contact = config().contactEmail;
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">Meus dados</h1>

      <section className={CARD} aria-labelledby="seus-dados">
        <h2 id="seus-dados" className="font-display text-xl font-bold">Seus dados</h2>
        <ActionForm action={updateProfileAction} submitLabel="Salvar" successMessage="Dados salvos." className="space-y-4" buttonClassName={SAVE}>
          <label className={LABEL}>Seu nome<input className={INPUT} name="name" required autoComplete="name" defaultValue={p.name} /></label>
          <label className="flex min-h-11 items-start gap-2.5 text-sm leading-normal">
            <input type="checkbox" name="whatsappOptIn" defaultChecked={p.whatsappOptIn} className="mt-0.5 size-5 flex-none accent-indigo-600" />
            Receber as confirmações e os lembretes das aulas pelo WhatsApp.
          </label>
        </ActionForm>
      </section>

      <section className={CARD} aria-labelledby="email">
        <div>
          <h2 id="email" className="font-display text-xl font-bold">E-mail</h2>
          <p className="text-sm text-site-muted">É por ele que você entra na conta e recebe os comprovantes.</p>
        </div>
        <p className="font-semibold [overflow-wrap:anywhere]" data-testid="email-atual">{p.email ?? 'Nenhum e-mail cadastrado'}</p>
        <EmailChange start={emailStartAction} finish={emailFinishAction} />
      </section>

      <section className={CARD} aria-labelledby="whatsapp">
        <h2 id="whatsapp" className="font-display text-xl font-bold">WhatsApp e conta</h2>
        <p className="font-semibold">{formatPhoneBR(p.phone)}</p>
        <p className="text-sm text-site-muted">
          Para trocar o número do WhatsApp ou excluir a conta e os seus dados, escreva para{' '}
          <a className="font-semibold text-indigo-600 underline" href={`mailto:${contact}`}>{contact}</a>. Veja também a{' '}
          <Link className="font-semibold text-indigo-600 underline" href="/privacidade">política de privacidade</Link>.
        </p>
      </section>
    </div>
  );
}
