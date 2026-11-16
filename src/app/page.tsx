import Link from 'next/link';

export default function Home() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Aulas particulares</h1>
      <p className="text-slate-700">
        Professores verificados, horário real e pagamento protegido, para alunos do 6º ano ao ensino médio.
      </p>
      <div className="card space-y-2">
        <h2 className="font-medium">Sou professor</h2>
        <p className="text-sm text-slate-600">Cadastre-se, envie seus documentos e monte sua agenda.</p>
        <Link className="btn" href="/professor/entrar">
          Entrar ou cadastrar
        </Link>
      </div>
    </div>
  );
}
