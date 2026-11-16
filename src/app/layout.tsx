import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Aulas particulares',
  description: 'Aulas particulares com professores verificados, do 6º ano ao ensino médio.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
