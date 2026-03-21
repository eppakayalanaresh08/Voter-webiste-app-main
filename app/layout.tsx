import './globals.css';
import type { Metadata } from 'next';
import MaterialThemeProvider from '@/components/material-theme-provider';

export const metadata: Metadata = {
  title: 'Voter CRM',
  description: 'Offline-first booth voter CRM',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/Clickvote.png', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
    ],
    shortcut: '/icons/Clickvote.png',
    apple: '/icons/Clickvote.png'
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                var host = window.location.hostname;
                var isLocal = host === 'localhost' || host === '127.0.0.1';
                if (!isLocal || !('serviceWorker' in navigator)) return;
                navigator.serviceWorker.getRegistrations().then(function (regs) {
                  regs.forEach(function (reg) { reg.unregister(); });
                });
                if ('caches' in window) {
                  caches.keys().then(function (keys) {
                    keys.forEach(function (key) { caches.delete(key); });
                  });
                }
              })();
            `
          }}
        />
        <MaterialThemeProvider>{children}</MaterialThemeProvider>
      </body>
    </html>
  );
}
