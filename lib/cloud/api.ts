import type { SupabaseClient } from '@supabase/supabase-js';
import type { PracticeNotebook } from '../practice/index';
import { parseCloudSnapshot, parseSaveReceipt, type CloudSnapshot } from './notebookSync';

export const readCloudNotebook = async (client: SupabaseClient, userId: string, signal: AbortSignal): Promise<CloudSnapshot | null> => {
  const { data, error } = await client.from('notebooks').select('user_id,notebook,revision,updated_at')
    .eq('user_id', userId).abortSignal(signal).maybeSingle();
  if (error) throw error;
  return parseCloudSnapshot(data, userId);
};

export const saveCloudNotebook = async (client: SupabaseClient, notebook: PracticeNotebook, expectedRevision: number, signal: AbortSignal) => {
  const { data, error } = await client.rpc('save_notebook', { p_notebook: notebook, p_expected_revision: expectedRevision }).abortSignal(signal);
  if (error) throw error;
  return parseSaveReceipt(data, expectedRevision);
};
