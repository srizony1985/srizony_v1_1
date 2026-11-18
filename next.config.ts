import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        // Report-only first: observe real page violations before enforcing CSP.
        { key: 'Content-Security-Policy-Report-Only', value: "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; img-src 'self' data: blob: https:; font-src 'self' data: https:; style-src 'self' 'unsafe-inline' https:; script-src 'self' 'unsafe-inline' https:; connect-src 'self' https: wss:; frame-src 'self' https:; form-action 'self' https:; report-uri /api/security/csp-report" },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
      ],
    }]
  },
  images: {
    // Restrict storage-host access to the public-assets path. `domains` is
    // deprecated and would allow every path on each host.
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'api.dicebear.com' },
      {
        protocol: 'https',
        hostname: 'br-weathered-water-b3x7n5e4.storage.c-4.ap-southeast-1.aws.neon.tech',
        pathname: '/public-assets/**',
      },
      {
        protocol: 'https',
        hostname: 'br-noisy-heart-aooybxhv.storage.c-2.ap-southeast-1.aws.neon.tech',
        pathname: '/public-assets/**',
      },
    ],
  },
}

export default nextConfig
