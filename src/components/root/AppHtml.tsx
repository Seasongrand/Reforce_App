/**
 * Documento (html e body) das áreas com o visual do app: painéis, área do
 * aluno, equipe e /dev. O site público tem o próprio documento, com o kit da
 * skill de design (src/app/(site)/layout.tsx); por serem layouts raiz
 * diferentes, passar de um para o outro recarrega a página, e o CSS de um
 * nunca vaza para o outro.
 */
import type { Metadata } from 'next';
import { Inter, Schibsted_Grotesk, Space_Grotesk } from 'next/font/google';
import '@/app/globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], display: 'swap', variable: '--font-space-grotesk' });
// a fonte do site público (skill de design): todas as áreas do app a usam pelas variáveis --app-text e --app-display
const schibsted = Schibsted_Grotesk({ subsets: ['latin'], display: 'swap', variable: '--font-schibsted' });
const FONT = { '--app-text': 'var(--font-schibsted)', '--app-display': 'var(--font-schibsted)' } as React.CSSProperties;

/** `config()` exige DATABASE_URL e o layout também roda no build: aqui basta o endereço público. */
export function appMetadata(): Metadata {
  return {
    metadataBase: new URL(process.env.APP_BASE_URL ?? 'http://localhost:3000'),
    title: 'Aulas particulares',
    description: 'Aulas particulares com professores verificados, do 6º ano ao ensino médio.',
  };
}

export function AppHtml({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${spaceGrotesk.variable} ${schibsted.variable}`} style={FONT}>
      <body className="bg-[#fbfaff] font-site text-indigo-950">{children}</body>
    </html>
  );
}
