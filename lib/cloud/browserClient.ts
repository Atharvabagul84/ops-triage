import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;
const configuration = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  const parsed = new URL(url);
  const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  if ((parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) || !key.startsWith('sb_publishable_')) {
    throw new Error('Cloud accounts are unavailable because deployment configuration is invalid.');
  }
  return { url, key };
};

export const getBrowserCloudClient = (): SupabaseClient | null => {
  if (typeof window === 'undefined') return null;
  const config = configuration();
  if (!config) return null;
  browserClient ??= createClient(config.url, config.key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return browserClient;
};

// Bind each transfer to the account that initiated it. A later auth event cannot
// cause an in-flight upload to use a different account's token.
export const createCloudTransferClient = (accessToken: string): SupabaseClient => {
  const config = configuration();
  if (!config) throw new Error('Cloud accounts are not configured.');
  return createClient(config.url, config.key, {
    accessToken: async () => accessToken,
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
};

export const createCloudRecoveryClient = (): SupabaseClient => {
  const config = configuration();
  if (!config) throw new Error('Cloud accounts are not configured.');
  return createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: `opstriage-recovery-${crypto.randomUUID()}` },
  });
};
