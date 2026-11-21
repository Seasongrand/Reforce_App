'use client';

/**
 * Carrega os scripts do kit da skill de design (public/assets) depois da
 * hidratação do React: eles mexem no DOM (topo no celular, momentos, entrada
 * do herói), e rodar antes faria o React refazer a página e perder o que
 * fizeram. Rodam uma vez por carregamento: os links do site público são
 * <a> comuns, então cada página chega por um carregamento novo.
 */
import { useEffect } from 'react';

const SCRIPTS = ['/assets/system.js', '/assets/motion/motion.js', '/assets/layout/layout.js'];

export function KitScripts() {
  useEffect(() => {
    for (const src of SCRIPTS) {
      if (document.querySelector(`script[src="${src}"]`)) continue;
      const s = document.createElement('script');
      s.type = 'module';
      s.src = src;
      document.body.appendChild(s);
    }
  }, []);
  return null;
}
