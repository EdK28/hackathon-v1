const API_URL = process.env.API_URL || 'http://localhost:4100';

/** @type {import('next').NextConfig} */
export default {
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }];
  },
};
