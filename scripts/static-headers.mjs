export function cloudConnectSource(url, key) {
  if (!url && !key) return "'self'";
  try {
    if (!url || !key?.startsWith('sb_publishable_')) throw new Error();
    const parsed = new URL(url);
    const local = ['localhost', '127.0.0.1'].includes(parsed.hostname);
    if ((parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw new Error();
    return `'self' ${parsed.origin}`;
  } catch { throw new Error('Invalid public cloud configuration. Supply a project origin and publishable key, or leave both empty.'); }
}
