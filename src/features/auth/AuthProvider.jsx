import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../../shared/supabase/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }

    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      setUser(session?.user || null);
      setLoading(false);
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
    });

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) console.error('Could not restore the Supabase session:', error.message);
      setUser(data?.session?.user || null);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const requireClient = useCallback(() => {
    if (!supabase) throw new Error('Account sign-in is not configured yet. Add the Supabase project URL and publishable key to the app environment.');
    return supabase;
  }, []);

  const signUp = useCallback(async (email, password) => {
    const client = requireClient();
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin }
    });
    if (error) throw error;
    return data;
  }, [requireClient]);

  const signIn = useCallback(async (email, password) => {
    const client = requireClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }, [requireClient]);

  const sendPasswordReset = useCallback(async email => {
    const client = requireClient();
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });
    if (error) throw error;
  }, [requireClient]);

  const updatePassword = useCallback(async password => {
    const client = requireClient();
    const { error } = await client.auth.updateUser({ password });
    if (error) throw error;
    setPasswordRecovery(false);
  }, [requireClient]);

  const clearPasswordRecovery = useCallback(() => setPasswordRecovery(false), []);

  const signOut = useCallback(async () => {
    const client = requireClient();
    const { error } = await client.auth.signOut();
    if (error) throw error;
    setPasswordRecovery(false);
  }, [requireClient]);

  const value = useMemo(() => ({
    user,
    loading,
    configured: isSupabaseConfigured,
    passwordRecovery,
    clearPasswordRecovery,
    signUp,
    signIn,
    sendPasswordReset,
    updatePassword,
    signOut
  }), [user, loading, passwordRecovery, clearPasswordRecovery, signUp, signIn, sendPasswordReset, updatePassword, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside AuthProvider.');
  return auth;
}
