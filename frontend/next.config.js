/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    domains: [],
  },
  async redirects() {
    return [{ source: '/favicon.ico', destination: '/icon.svg', permanent: false }]
  },
  async rewrites() {
    // Proxy API em desenvolvimento local
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/:path*',
          destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'}/:path*`,
        },
      ];
    }
    return [];
  },
}

module.exports = nextConfig
