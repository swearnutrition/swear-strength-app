declare module 'next-pwa' {
  import type { NextConfig } from 'next';

  interface RuntimeCacheOptions {
    cacheName: string;
    expiration?: {
      maxEntries?: number;
      maxAgeSeconds?: number;
    };
    networkTimeoutSeconds?: number;
  }

  interface RuntimeCacheEntry {
    urlPattern: RegExp;
    handler: 'CacheFirst' | 'NetworkFirst' | 'NetworkOnly' | 'CacheOnly' | 'StaleWhileRevalidate';
    options?: RuntimeCacheOptions;
  }

  interface PWAConfig {
    dest: string;
    register?: boolean;
    skipWaiting?: boolean;
    disable?: boolean;
    runtimeCaching?: RuntimeCacheEntry[];
    buildExcludes?: (string | RegExp)[];
    publicExcludes?: string[];
    fallbacks?: {
      document?: string;
      image?: string;
      font?: string;
      audio?: string;
      video?: string;
    };
  }

  function withPWAInit(config: PWAConfig): (nextConfig: NextConfig) => NextConfig;

  export default withPWAInit;
}
