import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // pg e graphile-worker usam módulos nativos do Node: ficam fora do bundle do servidor
  serverExternalPackages: ['pg', 'graphile-worker'],
  poweredByHeader: false,
  // documentos de verificação: até 3 arquivos de 10 MB
  experimental: { serverActions: { bodySizeLimit: '32mb' } },
  // cabeçalhos de segurança em todas as respostas (revisão de 27/11): só HTTPS,
  // nenhuma página em moldura de outro site, sem adivinhar tipo de arquivo, endereço
  // completo só para o próprio site. A sala de vídeo abre no Daily (fora daqui), então
  // câmera e microfone ficam desligados nas páginas da Reforce.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
