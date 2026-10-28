export const isAuthEmailEnabled = (value: unknown): boolean => value === 'true';
export const AUTH_EMAIL_ENABLED = isAuthEmailEnabled(process.env.NEXT_PUBLIC_AUTH_EMAIL_ENABLED);
export const AUTH_EMAIL_UNAVAILABLE_MESSAGE = 'New accounts and password-reset emails are not available yet. Guest practice and notebook exports still work. Existing account holders can sign in.';

export const runAuthEmailAction = async <T>(enabled: boolean, action: () => Promise<T>): Promise<T> => {
  if (!enabled) throw new Error(AUTH_EMAIL_UNAVAILABLE_MESSAGE);
  return action();
};
