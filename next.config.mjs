import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Player photos / documents are NEVER served from a public origin — only via
  // short-lived S3 presigned URLs minted after a server-side authorization check.
  images: {
    remotePatterns: [],
  },
  experimental: {
    // Server Actions are used as the primary mutation surface; each is wrapped
    // by tenantAction() so authorize() + tenant-scope + audit always run.
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default withNextIntl(nextConfig);
