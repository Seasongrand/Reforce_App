import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="border-t border-indigo-900 bg-indigo-950 text-site-on-dark">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-8 text-sm">
        <span>Reforce · Mais tempo para ensinar. Mais confiança para aprender.</span>
        <div className="flex flex-wrap gap-x-6">
          <Link href="/professores" className="inline-flex min-h-11 items-center text-white underline">Para professores</Link>
          <Link href="/privacidade" className="inline-flex min-h-11 items-center text-white underline">
            Política de privacidade
          </Link>
        </div>
      </div>
    </footer>
  );
}
