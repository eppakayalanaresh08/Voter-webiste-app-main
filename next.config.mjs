import withPWA from 'next-pwa';

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',

  images: {
    unoptimized: true
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  typescript: {
    ignoreBuildErrors: true
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb'
    }
  }
};

export default withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: ({ request }) => request.destination === 'document',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages',
        networkTimeoutSeconds: 5,
        expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 }
      }
    },
    {
      urlPattern: ({ request }) => ['style', 'script', 'worker'].includes(request.destination),
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'assets',
        expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }
      }
    },
    {
      urlPattern: ({ request }) => request.destination === 'image',
      handler: 'CacheFirst',
      options: {
        cacheName: 'images',
        expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }
      }
    }
  ]
})(nextConfig);
