/** @type {import('next').NextConfig} */
const nextConfig = {
  // Replace deprecated images.domains with remotePatterns
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'supabase.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  turbopack: {
    root: process.cwd(),
  },
  reactStrictMode: true,
  poweredByHeader: false,
}

module.exports = nextConfig