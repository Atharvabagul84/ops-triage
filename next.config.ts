import type { NextConfig } from "next";

const isStaticExport = process.env.OPSTRIAGE_STATIC_EXPORT === '1';
const development = process.env.NODE_ENV === 'development';
const cloudOrigin = (() => {
  try { return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : ''; }
  catch { return ''; }
})();
const nextConfig: NextConfig = {
  output: isStaticExport ? 'export' : undefined,
  turbopack: { root: process.cwd() },
  outputFileTracingRoot: process.cwd(),
  poweredByHeader: false,
  headers: isStaticExport ? undefined : async () => {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Content-Security-Policy', value: `default-src 'self'; script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ${cloudOrigin}${development ? ' ws: http://localhost:* http://127.0.0.1:*' : ''}; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'` },
    ] }];
  },
};

export default nextConfig;
