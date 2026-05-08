import './globals.css';
import { APP_NAME, APP_SHORT_NAME } from '@/lib/version';

export const metadata = {
  title: APP_NAME,
  description: '大自在山活動報名與管理',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: APP_SHORT_NAME,
  },
  formatDetection: { telephone: false },
};

export const viewport = {
  themeColor: '#8B1A1A',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-TW">
      <head>
        <meta name="application-name" content={APP_SHORT_NAME} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
