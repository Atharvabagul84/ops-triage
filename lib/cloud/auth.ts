import type { Session, SupabaseClient } from '@supabase/supabase-js';

// Use a client with in-memory auth for this operation, never the shared client.
export const updateRecoveredPassword = async (client: SupabaseClient, session: Session, password: string, isCurrent: () => boolean = () => true): Promise<void> => {
  if (password.length < 8 || password.length > 256) throw new Error('Use a password between 8 and 256 characters.');
  const restored = await client.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
  if (restored.error) throw restored.error;
  if (restored.data.user?.id !== session.user.id || !isCurrent()) throw new Error('The recovery session changed. Reopen your recovery link before trying again.');
  const updated = await client.auth.updateUser({ password });
  if (updated.error) throw updated.error;
  if (updated.data.user?.id !== session.user.id) throw new Error('The account update could not be confirmed.');
};
