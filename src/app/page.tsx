import Link from 'next/link';
import { config } from '@/config';
import { SUBJECTS } from '@/domain/catalog';
import { EDUCATION, MODALITIES, STAGES } from '@/domain/waitlist';
import { WaitlistForm } from '@/components/WaitlistForm';
import { joinWaitlistAction } from './actions';

export const dynamic = 'force-dynamic';

const options = (o: Record<string, string>) => Object.entries(o).map(([value, label]) => ({ value, label }));

export default function Home() {
  if (config().siteMode === 'lista_de_espera') return <WaitlistLanding />;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Reforce</h1>
      <p className="text-slate-700">
        Professores verificados, horário real e pagamento protegido, para alunos do 6º ano ao ensino médio.
      </p>
      <div className="card space-y-2">
        <h2 className="font-medium">Sou professor</h2>
        <p className="text-sm text-slate-600">Cadastre-se, envie seus documentos e monte sua agenda.</p>
        <Link className="btn" href="/professor/entrar">Entrar ou cadastrar</Link>
      </div>
    </div>
  );
}

function WaitlistLanding() {
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-wide text-brand">Reforce</p>
        <h1 className="text-3xl font-semibold leading-tight">Aulas particulares com professores verificados, do 6º ano ao ensino médio</h1>
        <p className="text-slate-700">
          A família encontra um professor verificado, reserva um horário real da agenda dele e paga na plataforma.
          A aula acontece por vídeo ou presencialmente.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">É professor? Estamos selecionando os primeiros</h2>
        <ul className="list-disc space-y-1 pl-5 text-slate-700">
          <li>Sua página própria, com sua agenda e horários livres de verdade, para divulgar aos seus alunos.</li>
          <li>Cobrança por PIX ou cartão feita pela plataforma, sem constrangimento de cobrar.</li>
          <li>Pagamento garantido depois da aula, sem ação sua.</li>
          <li>Verificação de identidade, antecedentes e formação, que dá confiança aos pais.</li>
          <li>Aula online na sala da plataforma ou presencial, com seu tempo de deslocamento respeitado.</li>
        </ul>
        <p className="text-sm text-slate-600">
          Entre na lista de espera. Avisamos quando abrirmos a seleção na sua região e disciplina.
        </p>
      </section>

      <WaitlistForm
        action={joinWaitlistAction}
        subjects={SUBJECTS.map((s) => ({ value: String(s.id), label: s.name }))}
        stages={options(STAGES)}
        modalities={options(MODALITIES)}
        education={options(EDUCATION)}
      />

      <footer className="text-xs text-slate-500">
        <Link className="underline" href="/privacidade">Política de privacidade</Link>
      </footer>
    </div>
  );
}
