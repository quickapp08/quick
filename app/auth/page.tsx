"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type Mode = "login" | "register";
type Msg = { type: "success" | "error" | "info"; text: string } | null;

export default function AuthPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const initialMode = useMemo<Mode>(() => {
    const m = sp.get("mode");
    return m === "register" ? "register" : "login";
  }, [sp]);

  const [mode, setMode] = useState<Mode>(initialMode);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  const submit = async () => {
    setLoading(true);
    setMsg(null);

    if (!email.trim() || !password.trim()) {
      setMsg({ type: "error", text: "Enter email and password." });
      setLoading(false);
      return;
    }

    if (mode === "register") {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        setMsg({ type: "error", text: error.message });
        setLoading(false);
        return;
      }

      // Ako email confirm nije uključen, user će biti odmah logiran.
      // Ako jest, i dalje je ok — user se može logirati nakon potvrde.
      setMsg({ type: "success", text: "Account created. You can now login." });
      setLoading(false);
      return;
    }

    // login
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setMsg({ type: "error", text: error.message });
      setLoading(false);
      return;
    }

    setMsg({ type: "success", text: "Signed in." });
    setLoading(false);

    // Vraćamo na home — home će vidjeti session i prebaciti na MENU
    router.push("/");
    router.refresh();
  };

  const msgBox = (m: Msg) => {
    if (!m) return null;

    const base = "mt-4 rounded-xl border px-3 py-2 text-[13px] leading-snug";
    const cls =
      m.type === "success"
        ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
        : m.type === "error"
        ? "border-rose-400/20 bg-rose-500/10 text-rose-100"
        : "border-white/12 bg-white/6 text-white/80";

    return <div className={cx(base, cls)}>{m.text}</div>;
  };

  return (
    <main
      className="min-h-[100svh] w-full bg-gradient-to-b from-slate-950 via-slate-950 to-blue-950 text-white"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 18px)",
        paddingBottom: "max(env(safe-area-inset-bottom), 18px)",
      }}
    >
      <div className="mx-auto flex min-h-[100svh] max-w-md flex-col px-4">
        <header className="pt-2">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="rounded-xl border border-white/12 bg-white/6 px-3 py-2 text-[13px] text-white/80 transition hover:bg-white/10 active:scale-[0.98] touch-manipulation"
            >
              ← Back
            </Link>

            <div className="text-[13px] font-semibold text-white/85">Auth</div>
            <div className="w-[64px]" />
          </div>

          <h1 className="mt-5 text-2xl font-bold tracking-tight">
            {mode === "login" ? "Login" : "Register"}
          </h1>
          <p className="mt-2 text-[13px] text-white/70">
            Ranked access + tournaments.
          </p>
        </header>

        <section className="mt-6 rounded-3xl border border-white/12 bg-white/6 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode("login")}
              className={cx(
                "rounded-xl px-3 py-2 text-[13px] font-semibold transition active:scale-[0.98] touch-manipulation",
                mode === "login"
                  ? "border border-blue-300/25 bg-blue-500/15 text-white"
                  : "border border-white/12 bg-white/6 text-white/70 hover:bg-white/10"
              )}
            >
              Login
            </button>

            <button
              onClick={() => setMode("register")}
              className={cx(
                "rounded-xl px-3 py-2 text-[13px] font-semibold transition active:scale-[0.98] touch-manipulation",
                mode === "register"
                  ? "border border-blue-300/25 bg-blue-500/15 text-white"
                  : "border border-white/12 bg-white/6 text-white/70 hover:bg-white/10"
              )}
            >
              Register
            </button>
          </div>

          <div className="mt-4 space-y-2">
            <input
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              className="w-full rounded-xl border border-white/12 bg-slate-950/40 px-4 py-3 text-[15px] text-white placeholder:text-white/35 outline-none focus:ring-2 focus:ring-blue-400/60"
            />

            <input
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="w-full rounded-xl border border-white/12 bg-slate-950/40 px-4 py-3 text-[15px] text-white placeholder:text-white/35 outline-none focus:ring-2 focus:ring-blue-400/60"
            />

            <button
              onClick={submit}
              disabled={loading}
              className="w-full rounded-2xl border border-blue-300/25 bg-gradient-to-b from-blue-500/25 to-blue-500/10 px-5 py-4 text-left transition hover:-translate-y-[1px] hover:shadow-[0_0_40px_rgba(59,130,246,0.28)] active:scale-[0.98] touch-manipulation disabled:opacity-60"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[16px] font-semibold">
                    {loading
                      ? "Please wait…"
                      : mode === "login"
                      ? "Login"
                      : "Create account"}
                  </div>
                  <div className="mt-1 text-[12px] text-white/65">
                    {mode === "login" ? "Continue your progress" : "Ranked access + tournaments"}
                  </div>
                </div>
                <div className="text-white/55">→</div>
              </div>
            </button>

            <div className="pt-2 text-center text-[11px] text-white/45">
              (MVP) Email confirmation can be added later.
            </div>

            {msgBox(msg)}
          </div>
        </section>

        <footer className="mt-auto pb-2 pt-8 text-center text-[11px] text-white/40">
          Quick • Auth
        </footer>
      </div>
    </main>
  );
}
