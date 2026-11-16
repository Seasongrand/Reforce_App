import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], display: 'swap', variable: '--font-space-grotesk' });

/** `config()` exige DATABASE_URL e o layout também roda no build: aqui basta o endereço público. */
export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(process.env.APP_BASE_URL ?? 'http://localhost:3000'),
    title: 'Aulas particulares',
    description: 'Aulas particulares com professores verificados, do 6º ano ao ensino médio.',
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body>{children}</body>
    </html>
  );
}
