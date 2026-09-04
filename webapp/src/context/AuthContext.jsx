import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setLoading(true);
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        setProfile(data);
        setLoading(false);
      });
  }, [session]);



  const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({ provider: 'google' });

  const signInWithEmailOtp = (email) =>
    supabase.auth.signInWithOtp({ email });

  const verifyEmailOtp = (email, token) =>
    supabase.auth.verifyOtp({ email, token, type: 'email' });

  const signOut = () => supabase.auth.signOut();

  return (
    <AuthContext.Provider
      value={{ session, profile, loading, signInWithGoogle, signInWithEmailOtp, verifyEmailOtp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de AuthProvider');
  return ctx;
}
