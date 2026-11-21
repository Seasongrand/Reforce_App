import type { Metadata, Viewport } from 'next';
import { KitScripts } from '@/components/site/kit/KitScripts';

/**
 * Documento próprio do site público (lista de espera, página para
 * professores, página inicial, Entrar e privacidade), no sistema da skill
 * design-taste-frontend (AGENTS.md): o kit fica em public/assets e é carregado
 * como arquivos comuns. Por ser outro layout raiz, ir daqui para os painéis
 * recarrega a página e o CSS do kit nunca chega lá.
 *
 * Sorteio da skill (21/11): tipo service; herói split; fonte Schibsted
 * Grotesk; cores da marca (índigo e violeta, exceção do dono); topo
 * nav-centre; rodapé footer-dark; fechamento close-type; ritmo dark-band;
 * botões solid; marca arc; momento pinned-chapters em "Como funciona".
 */
export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_BASE_URL ?? 'http://localhost:3000'),
  title: 'Reforce: agenda e cobrança para professores particulares',
  description:
    'Página própria com os horários livres, pagamento por PIX ou cartão na reserva e sala de aula online. Lista de espera aberta para os primeiros professores.',
  openGraph: { siteName: 'Reforce', locale: 'pt_BR', type: 'website' },
  twitter: { card: 'summary_large_image' },
  other: { 'site-kind': 'other', 'page-type': 'service' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#fbfaff' };

const KIT_CSS = ['system.css', 'ui/cards.css', 'motion/motion.css', 'layout/layout.css', 'icons/icon.css', 'site.css'];

// As cores são as da marca (start.mjs brand), não as sorteadas: o índigo e o violeta ficam por decisão do dono.
const ROOT = `:root{--p-bg:#fbfaff;--p-surface:#f1effd;--p-ink:#1e1b4b;--p-muted:#4b4880;--p-accent:#4f46e5;--p-accent-ink:#fbfaff;--p-action:#4f46e5;--p-action-ink:#fbfaff;--p-inv-bg:#1e1b4b;--p-inv-surface:#2a2957;--p-inv-ink:#fbfaff;--p-inv-muted:#9e9fb8;--p-inv-accent:#fbfaff;--p-inv-accent-ink:#1e1b4b;--p-inv-action:#fbfaff;--p-inv-action-ink:#1e1b4b;--font-display:"Schibsted Grotesk",system-ui,sans-serif;--font-text:"Schibsted Grotesk",system-ui,sans-serif;--display-weight:400;--display-tracking:-0.035em;--display-tracking-xl:-0.042em;--ly-scale:0.98}`;

// A entrada do herói e a guarda dos momentos, antes da primeira pintura (motion.md e moments.md).
const BOOT =
  "document.documentElement.classList.add('m-enter','mo-js');" +
  "setTimeout(function(){document.documentElement.classList.add('m-enter-done')},700);" +
  "setTimeout(function(){document.documentElement.classList.add('mo-safe')},2500);";

export default function SiteRootLayout({ children }: { children: React.ReactNode }) {
  return (
    // os scripts do kit mexem nas classes do <html> antes da hidratação
    <html lang="pt-BR" data-type="service" data-radius="soft" data-buttons="solid" data-motion="" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400..700&display=swap" rel="stylesheet" />
        {KIT_CSS.map((f) => (
          <link key={f} rel="stylesheet" href={`/assets/${f}`} />
        ))}
        <style dangerouslySetInnerHTML={{ __html: ROOT }} />
        <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      </head>
      <body>
        {children}
        <KitScripts />
      </body>
    </html>
  );
}
