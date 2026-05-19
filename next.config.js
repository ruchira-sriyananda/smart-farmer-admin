/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow images from Supabase
  images: {
    domains: ['supabase.co'],
  },
  
  // Fix the workspace root warning
  turbopack: {
    root: process.cwd(),
  },
  
  // Enable React Strict Mode
  reactStrictMode: true,
  
  // Remove the "x-powered-by" header
  poweredByHeader: false,
}

module.exports = nextConfig