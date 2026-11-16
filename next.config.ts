import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // pg e graphile-worker usam módulos nativos do Node: ficam fora do bundle do servidor
  serverExternalPackages: ['pg', 'graphile-worker'],
  poweredByHeader: false,
};

export default nextConfig;
