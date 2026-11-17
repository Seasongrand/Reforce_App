'use client';

import { useState } from 'react';
import { PRIMARY } from './ui';

/** Copia o código PIX; confirma por 2 segundos. Sem acesso à área de transferência, seleciona o texto para copiar à mão. */
export function CopyButton({ text, label, targetId }: { text: string; label: string; targetId?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = targetId ? document.getElementById(targetId) : null;
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
      }
    }
  };
  return (
    <button type="button" onClick={copy} className={PRIMARY} aria-live="polite">
      {copied ? 'Código copiado' : label}
    </button>
  );
}
