import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // pg e graphile-worker usam módulos nativos do Node: ficam fora do bundle do servidor
  serverExternalPackages: ['pg', 'graphile-worker'],
  poweredByHeader: false,
  // documentos de verificação: até 3 arquivos de 10 MB
  experimental: { serverActions: { bodySizeLimit: '32mb' } },
};

export default nextConfig;
