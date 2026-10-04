import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { pwaApp } from '@huishouden/pwa-kit/vite';

const googleFontsCache = (urlPattern: RegExp, cacheName: string) => ({
  urlPattern,
  handler: 'CacheFirst' as const,
  options: {
    cacheName,
    expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
    cacheableResponse: { statuses: [0, 200] },
  },
});

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    pwaApp({
      // Car's path on the suite's one site (pwa-kit docs/one-site.md).
      base: '/car/',
      name: 'Huishouden Car',
      shortName: 'Car',
      description: "Keeping the cars on the road",
      themeColor: '#1b4332',
      backgroundColor: '#faf9f5',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      overrides: {
        manifest: { categories: ['lifestyle', 'productivity', 'utilities'] },
        workbox: {
          runtimeCaching: [
            googleFontsCache(/^https:\/\/fonts\.googleapis\.com\/.*/i, 'google-fonts-cache'),
            googleFontsCache(/^https:\/\/fonts\.gstatic\.com\/.*/i, 'gstatic-fonts-cache'),
          ],
        },
      },
    }),
  ],
});
