import type { ReactNode } from 'react';
import { SiteClosing } from '@/components/site/kit/SiteClosing';
import { SiteNav } from '@/components/site/kit/SiteNav';
import { config } from '@/config';

/** Moldura das páginas legais (termos e privacidade): mesmo topo, coluna de leitura e rodapé. */
export function LegalShell({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  const contact = config().contactEmail;
  return (
    <>
      <SiteNav links={[{ href: '/professores', label: 'Professores' }, { href: '/entrar', label: 'Alunos' }]} />
      <main id="top">
        <section className="section legal" style={{ ['--h' as string]: 2 }} aria-labelledby="legal-h">
          <div className="wrap">
            <article className="measure stack-4">
              <h1 id="legal-h" className="t-h2">{title}</h1>
              <p className="t-small">Atualizada em {updated}.</p>
              {children}
              <CompanyIdentity />
            </article>
          </div>
        </section>
      </main>
      <SiteClosing
        title="Dúvidas sobre estas regras ou sobre os seus dados"
        lead="Escreva para a equipe. Respondemos por e-mail."
        action={{ href: `mailto:${contact}`, label: 'Escrever para a equipe' }}
        columns={[
          { title: 'Reforce', links: [{ href: '/termos', label: 'Termos de uso' }, { href: '/privacidade', label: 'Privacidade' }] },
          { title: 'Acesso', links: [{ href: '/professores', label: 'Professores' }, { href: '/entrar', label: 'Alunos' }] },
        ]}
      />
    </>
  );
}

/** Quem é a Reforce: nome empresarial, CNPJ e endereço, quando configurados (COMPANY_*), e o e-mail. */
export function CompanyIdentity() {
  const { company, contactEmail } = config();
  const parts = [
    company.legalName,
    company.cnpj && `CNPJ ${company.cnpj}`,
    company.address,
  ].filter(Boolean);
  return (
    <p className="t-small">
      Reforce{parts.length > 0 ? ` · ${parts.join(' · ')}` : ''} · <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
    </p>
  );
}
