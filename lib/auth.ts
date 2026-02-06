"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export function useSupabaseUser() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<null | { id: string; email?: string | null }>(null);

  useEffect(() => {
    let alive = true;

    // initial session
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      const u = data.session?.user ?? null;
      setUser(u ? { id: u.id, email: u.email } : null);
      setLoading(false);
    });

    // listen changes
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u ? { id: u.id, email: u.email } : null);
      setLoading(false);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}
