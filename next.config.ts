import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: '/api/:path*', destination: 'http://localhost:8000/api/:path*' },
      { source: '/media/:path*', destination: 'http://localhost:8000/media/:path*' },
    ];
  },
};

export default nextConfig;
