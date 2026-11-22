import type { Metadata } from 'next';
import { AppHtml, appMetadata } from '@/components/root/AppHtml';

export const metadata: Metadata = appMetadata();

/** Telas do marketplace: o invólucro estreito de sempre, até o redesenho delas (segundo projeto). */
export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppHtml>
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
    </AppHtml>
  );
}
