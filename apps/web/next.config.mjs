const API_URL = process.env.API_URL || 'http://localhost:4100';

/** @type {import('next').NextConfig} */
export default {
  experimental: {
    // AI replies (especially a local model's first, while it loads) can take longer than the 30s default
    proxyTimeout: 300_000,
  },
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }];
  },
};
