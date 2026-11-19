'use client';

import { useState } from 'react';
import { PRIMARY } from './ui';

/** Copia um texto (o código PIX, um link); confirma por 2 segundos. Sem acesso à área de transferência, seleciona o texto para copiar à mão. */
export function CopyButton({
  text, label, targetId, copiedLabel = 'Código copiado', className = PRIMARY,
}: { text: string; label: string; targetId?: string; copiedLabel?: string; className?: string }) {
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
    <button type="button" onClick={copy} className={className} aria-live="polite">
      {copied ? copiedLabel : label}
    </button>
  );
}
