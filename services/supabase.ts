import { AuthChangeEvent, Session, User, createClient } from '@supabase/supabase-js';
import { AuthenticatedUser } from '../types';

const SUPABASE_URL =
  ((globalThis as any).process?.env?.REACT_APP_SUPABASE_URL as string | undefined) ||
  '';

const SUPABASE_ANON_KEY =
  ((globalThis as any).process?.env?.REACT_APP_SUPABASE_ANON_KEY as string | undefined) ||
  '';

export const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      })
    : null;

const toAuthenticatedUser = (user: User | null): AuthenticatedUser | null => {
  if (!user) return null;

  const metadata = (user.user_metadata || {}) as Record<string, unknown>;

  return {
    id: user.id,
    email: user.email || '',
    fullName:
      (metadata.full_name as string | undefined) ||
      (metadata.name as string | undefined) ||
      null,
    avatarUrl: (metadata.avatar_url as string | undefined) || null,
    provider:
      (user.app_metadata?.provider as string | undefined) ||
      'unknown',
  };
};

export const isSupabaseConfigured = (): boolean => Boolean(supabase);

export const getSupabaseSession = async (): Promise<Session | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
};

export const getSupabaseUser = async (): Promise<AuthenticatedUser | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return toAuthenticatedUser(data.user);
};

export const getSupabaseUserId = async (): Promise<string | null> => {
  const user = await getSupabaseUser();
  return user?.id || null;
};

export const getSupabaseAccessToken = async (): Promise<string | null> => {
  const session = await getSupabaseSession();
  return session?.access_token || null;
};

export const signInWithGoogle = async (): Promise<{ error: Error | null }> => {
  if (!supabase) {
    return { error: new Error('Supabase is not configured') };
  }

  const redirectTo =
    typeof window !== 'undefined' ? window.location.origin : undefined;

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  return { error };
};

export const signOutSupabase = async (): Promise<{ error: Error | null }> => {
  if (!supabase) {
    return { error: null };
  }

  const { error } = await supabase.auth.signOut();
  return { error };
};

export const onSupabaseAuthStateChange = (
  cb: (event: AuthChangeEvent, session: Session | null, user: AuthenticatedUser | null) => void
): (() => void) => {
  if (!supabase) return () => undefined;

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    cb(event, session, toAuthenticatedUser(session?.user || null));
  });

  return () => {
    subscription.unsubscribe();
  };
};
