'use client';

/** Aviso no rodapé depois de uma mudança na Agenda, com "Desfazer" quando dá para voltar atrás. */
import { useEffect } from 'react';

export interface ToastMessage {
  text: string;
  undo?: () => void;
}

export function UndoToast({ message, onClose }: { message: ToastMessage | null; onClose: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 8000);
    return () => clearTimeout(t);
  }, [message, onClose]);
  if (!message) return null;
  return (
    <div role="status"
      className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] z-30 mx-auto flex max-w-xl items-center justify-between gap-3 rounded-2xl bg-indigo-950 py-2.5 pl-4 pr-2.5 text-sm text-white shadow-xl">
      <span>{message.text}</span>
      {message.undo && (
        <button type="button" onClick={() => { message.undo?.(); onClose(); }}
          className="min-h-10 flex-none rounded-xl bg-yellow-400 px-3 font-bold text-indigo-950">
          Desfazer
        </button>
      )}
    </div>
  );
}
