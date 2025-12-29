import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Swear Strength",
  description: "Premium fitness coaching platform - Track workouts, habits, and compete with rivals",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Swear Strength",
    startupImage: "/icon-512x512.png",
  },
  icons: {
    icon: [
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    title: "Swear Strength",
    description: "Premium fitness coaching platform",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: `
          #splash-screen {
            position: fixed;
            inset: 0;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: #0a0a0a;
            transition: opacity 0.3s ease-out;
          }
          #splash-screen.fade-out {
            opacity: 0;
            pointer-events: none;
          }
          #splash-screen img {
            width: 120px;
            height: 120px;
            animation: pulse 1.5s ease-in-out infinite;
          }
          #splash-screen .loading-bar {
            width: 100px;
            height: 3px;
            background: #1e1e1e;
            border-radius: 3px;
            margin-top: 24px;
            overflow: hidden;
          }
          #splash-screen .loading-bar-inner {
            height: 100%;
            width: 30%;
            background: linear-gradient(90deg, #8b5cf6, #a78bfa);
            border-radius: 3px;
            animation: loading 1s ease-in-out infinite;
          }
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.05); opacity: 0.9; }
          }
          @keyframes loading {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(400%); }
          }
        `}} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div id="splash-screen">
          <img src="/icon-512x512.png" alt="Swear Strength" />
          <div className="loading-bar">
            <div className="loading-bar-inner" />
          </div>
        </div>
        <script dangerouslySetInnerHTML={{ __html: `
          window.addEventListener('load', function() {
            setTimeout(function() {
              var splash = document.getElementById('splash-screen');
              if (splash) {
                splash.classList.add('fade-out');
                setTimeout(function() {
                  splash.style.display = 'none';
                }, 300);
              }
            }, 500);
          });
        `}} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
