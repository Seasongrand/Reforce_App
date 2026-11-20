/** Painel da equipe: fundo e fonte do site, como a área do professor (o painel e o login têm o próprio invólucro). */
export default function InternoGroupLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-violet-50/60 font-site text-indigo-950">{children}</div>;
}
