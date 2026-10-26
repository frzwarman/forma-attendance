import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { getSupabase } from "./supabase";

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) throw new Error("E-mail atau kata sandi salah");
}

export async function signOut(): Promise<void> {
  await getSupabase().auth.signOut();
}

export function useSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const auth = getSupabase().auth;
    void auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return { session, loading };
}
