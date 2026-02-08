"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-[100svh] bg-slate-950 px-4 pb-10 pt-6 text-white">
          <div className="mx-auto w-full max-w-md">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-[14px] font-semibold">Loading…</div>
              <div className="mt-2 text-[12px] text-white/60">
                Preparing account screen
              </div>
            </div>
          </div>
        </main>
      }
    >
      <AuthInner />
    </Suspense>
  );
}

function msgBox(msg: string | null) {
  if (!msg) return null;
  return (
    <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
      {msg}
    </div>
  );
}

function normalizeUsername(raw: string) {
  // only: letters, numbers, underscore. lowercase stored.
  return raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
}

function isValidUsername(u: string) {
  if (u.length < 3) return "Username must be at least 3 characters.";
  if (u.length > 16) return "Username must be max 16 characters.";
  if (!/^[a-z0-9_]+$/.test(u)) return "Use only letters, numbers, underscore.";
  return null;
}

function AuthInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const mode = useMemo(() => {
    const m = (searchParams.get("mode") || "login").toLowerCase();
    return m === "register" ? "register" : "login";
  }, [searchParams]);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ✅ NEW: username (required for register)
  const [username, setUsername] = useState("");

  const [isAuthed, setIsAuthed] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const { data } = await supabase.auth.getSession();
      const s = data.session;
      if (!mounted) return;
      setIsAuthed(!!s);
      setUserEmail(s?.user?.email ?? null);
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthed(!!session);
      setUserEmail(session?.user?.email ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signIn() {
    setLoading(true);
    setMsg(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    router.push("/");
    router.refresh();
  }

  async function signUp() {
    setLoading(true);
    setMsg(null);

    const cleanEmail = email.trim();
    const cleanUsername = normalizeUsername(username);

    const errU = isValidUsername(cleanUsername);
    if (errU) {
      setLoading(false);
      setMsg(errU);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
    });

    if (error) {
      setLoading(false);
      setMsg(error.message);
      return;
    }

    // ✅ make sure profile exists + set username
    // signUp may or may not return session depending on email confirm settings
    const uid = data.user?.id;

    if (!uid) {
      // fallback: try getUser
      const res = await supabase.auth.getUser();
      const uid2 = res.data.user?.id;
      if (!uid2) {
        setLoading(false);
        setMsg("Account created, but user session not ready. Try login.");
        router.push("/auth?mode=login");
        return;
      }

      const { error: upErr2 } = await supabase
        .from("profiles")
        .upsert({ user_id: uid2, username: cleanUsername }, { onConflict: "user_id" });

      setLoading(false);

      if (upErr2) {
        // Most common: username already taken
        setMsg(upErr2.message.includes("profiles_username")
          ? "Username is already taken. Pick another."
          : upErr2.message
        );
        return;
      }

      router.push("/");
      router.refresh();
      return;
    }

    const { error: upErr } = await supabase
      .from("profiles")
      .upsert({ user_id: uid, username: cleanUsername }, { onConflict: "user_id" });

    setLoading(false);

    if (upErr) {
      setMsg(
        upErr.message.includes("profiles_username")
          ? "Username is already taken. Pick another."
          : upErr.message
      );
      return;
    }

    router.push("/");
    router.refresh();
  }

  async function signOut() {
    setLoading(true);
    setMsg(null);

    const { error } = await supabase.auth.signOut();

    setLoading(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    router.push("/");
    router.refresh();
  }

  const usernameHint = useMemo(() => {
    if (mode !== "register") return null;
    const clean = normalizeUsername(username);
    const err = clean ? isValidUsername(clean) : null;
    if (!username) return "3–16 chars • letters/numbers/_";
    if (err) return err;
    return "Looks good ✅";
  }, [mode, username]);

  return (
    <main className="min-h-[100svh] bg-slate-950 px-4 pb-10 pt-6 text-white">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <button
                onClick={() => router.push("/")}
                className="mt-1 rounded-xl border border-white/12 bg-white/6 px-3 py-2 text-[12px] text-white/80 transition hover:bg-white/10 active:scale-[0.98] touch-manipulation"
              >
                ← Back
              </button>

              <div>
                <h1 className="text-[18px] font-semibold tracking-tight text-white">
                  Account
                </h1>
                <p className="mt-1 text-[12px] text-white/65">
                  {isAuthed
                    ? `Signed in as ${userEmail ?? "user"}`
                    : "Sign in to sync scores and appear on the leaderboard."}
                </p>
              </div>
            </div>

            <div
              className={cx(
                "rounded-full border px-3 py-1 text-[12px]",
                isAuthed
                  ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
                  : "border-white/12 bg-white/6 text-white/70"
              )}
            >
              {isAuthed ? "Online" : "Guest"}
            </div>
          </div>

          {!isAuthed && (
            <div className="mt-5">
              <div className="flex gap-2">
                <button
                  onClick={() => router.push("/auth?mode=login")}
                  className={cx(
                    "flex-1 rounded-2xl border px-4 py-2 text-[12px] font-semibold transition active:scale-[0.98] touch-manipulation",
                    mode === "login"
                      ? "border-blue-300/30 bg-blue-500/15 text-white"
                      : "border-white/12 bg-white/6 text-white/70 hover:bg-white/10"
                  )}
                >
                  Login
                </button>
                <button
                  onClick={() => router.push("/auth?mode=register")}
                  className={cx(
                    "flex-1 rounded-2xl border px-4 py-2 text-[12px] font-semibold transition active:scale-[0.98] touch-manipulation",
                    mode === "register"
                      ? "border-blue-300/30 bg-blue-500/15 text-white"
                      : "border-white/12 bg-white/6 text-white/70 hover:bg-white/10"
                  )}
                >
                  Register
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {/* ✅ Username (register only) */}
                {mode === "register" ? (
                  <div>
                    <div className="mb-1 text-[12px] text-white/60">Username</div>
                    <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                      className="w-full rounded-2xl border border-white/12 bg-white/6 px-4 py-3 text-[14px] text-white outline-none placeholder:text-white/35 focus:border-blue-300/35 focus:ring-2 focus:ring-blue-400/20"
                      placeholder="e.g. karlo_7"
                    />
                    <div className={cx("mt-1 text-[11px]", usernameHint?.includes("✅") ? "text-emerald-200/70" : "text-white/45")}>
                      {usernameHint}
                    </div>
                  </div>
                ) : null}

                <div>
                  <div className="mb-1 text-[12px] text-white/60">Email</div>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    autoComplete="email"
                    className="w-full rounded-2xl border border-white/12 bg-white/6 px-4 py-3 text-[14px] text-white outline-none placeholder:text-white/35 focus:border-blue-300/35 focus:ring-2 focus:ring-blue-400/20"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <div className="mb-1 text-[12px] text-white/60">Password</div>
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    autoComplete={mode === "register" ? "new-password" : "current-password"}
                    className="w-full rounded-2xl border border-white/12 bg-white/6 px-4 py-3 text-[14px] text-white outline-none placeholder:text-white/35 focus:border-blue-300/35 focus:ring-2 focus:ring-blue-400/20"
                    placeholder="••••••••"
                  />
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  {mode === "register" ? (
                    <button
                      onClick={signUp}
                      disabled={loading}
                      className={cx(
                        "rounded-2xl px-4 py-3 text-sm font-semibold text-white transition",
                        "bg-blue-600 hover:bg-blue-700 border border-blue-500/30",
                        "disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] touch-manipulation"
                      )}
                    >
                      {loading ? "Please wait…" : "Create account"}
                    </button>
                  ) : (
                    <button
                      onClick={signIn}
                      disabled={loading}
                      className={cx(
                        "rounded-2xl px-4 py-3 text-sm font-semibold text-white transition",
                        "bg-blue-600 hover:bg-blue-700 border border-blue-500/30",
                        "disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] touch-manipulation"
                      )}
                    >
                      {loading ? "Please wait…" : "Sign in"}
                    </button>
                  )}

                  <button
                    onClick={() => router.push("/")}
                    disabled={loading}
                    className={cx(
                      "rounded-2xl border border-white/12 bg-white/6 px-4 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/10",
                      "disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] touch-manipulation"
                    )}
                  >
                    Home
                  </button>
                </div>

                <div className="mt-4 text-[12px] text-white/55">
                  When signed in, your results can be saved and ranked.
                </div>
              </div>

              {msgBox(msg)}
            </div>
          )}

          {isAuthed && (
            <div className="mt-5">
              <button
                onClick={signOut}
                disabled={loading}
                className={cx(
                  "w-full rounded-2xl border border-white/12 px-4 py-3 text-sm font-semibold transition",
                  "bg-white/6 hover:bg-white/10 text-white/85",
                  "disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] touch-manipulation"
                )}
              >
                {loading ? "Please wait…" : "Logout"}
              </button>

              {msgBox(msg)}
            </div>
          )}
        </div>

        <footer className="mt-8 text-center text-[11px] text-white/40">
          Quick © {new Date().getFullYear()}
        </footer>
      </div>
    </main>
  );
}
