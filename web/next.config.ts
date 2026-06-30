import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Anciennes routes non localisees -> equivalent /fr
      { source: '/digital-skills', destination: '/fr/digital-skills', permanent: true },
      { source: '/terms', destination: '/fr/terms', permanent: true },
      { source: '/privacy', destination: '/fr/privacy', permanent: true },
      { source: '/mentions-legales', destination: '/fr/legal', permanent: true },
      { source: '/legal', destination: '/fr/legal', permanent: true },
      // Anciens alias
      { source: '/observatoire', destination: '/fr/digital-skills', permanent: true },
      { source: '/etudesk-os', destination: '/fr', permanent: true },
      { source: '/stories', destination: '/fr', permanent: true },
      { source: '/stories/:slug', destination: '/fr', permanent: true },
      { source: '/qui-sommes-nous', destination: '/fr#qui-sommes-nous', permanent: true },
    ];
  },
};

export default nextConfig;
