"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";

type Screen = "welcome" | "menu";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Chip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[11px] text-white/70">
      {label}
    </span>
  );
}

function CardLink({
  href,
  title,
  desc,
  variant = "secondary",
  disabled = false,
}: {
  href: string;
  title: string;
  desc: string;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
}) {
  const base =
    "block w-full rounded-2xl px-5 py-4 text-left transition touch-manipulation " +
    "active:scale-[0.98] active:opacity-95 " +
    "hover:-translate-y-[1px] focus:outline-none focus:ring-2 focus:ring-blue-400/60";

  const styles = {
    primary:
      "bg-gradient-to-b from-blue-500/25 to-blue-500/10 border border-blue-300/25 " +
      "hover:border-blue-300/40 hover:shadow-[0_0_40px_rgba(59,130,246,0.28)]",
    secondary:
      "bg-white/6 border border-white/12 hover:border-white/22 hover:bg-white/10 " +
      "hover:shadow-[0_0_34px_rgba(59,130,246,0.14)]",
    ghost: "bg-transparent border border-white/12 hover:bg-white/6 hover:border-white/22",
  } as const;

  const content = (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[16px] font-semibold text-white">{title}</div>
        <div className="mt-1 text-[12px] leading-snug text-white/65">{desc}</div>
      </div>
      <div className="shrink-0 text-white/55">→</div>
    </div>
  );

  if (disabled) {
    return (
      <div className={cx(base, styles.secondary, "opacity-60 cursor-not-allowed")} aria-disabled>
        {content}
      </div>
    );
  }

  return (
    <Link href={href} className={cx(base, styles[variant])}>
      {content}
    </Link>
  );
}

function CardButton({
  title,
  desc,
  onClick,
  locked,
}: {
  title: string;
  desc: string;
  onClick: () => void;
  locked?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "w-full rounded-2xl border border-white/12 bg-white/6 px-5 py-4 text-left transition touch-manipulation",
        "hover:border-white/22 hover:bg-white/10 hover:shadow-[0_0_34px_rgba(59,130,246,0.14)]",
        "active:scale-[0.98] active:opacity-95",
        locked ? "opacity-75" : ""
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-[16px] font-semibold text-white">{title}</div>
            {locked ? (
              <span className="rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[11px] text-white/70">
                Locked
              </span>
            ) : null}
          </div>
          <div className="mt-1 text-[12px] leading-snug text-white/65">{desc}</div>
        </div>
        <div className="shrink-0 text-white/55">→</div>
      </div>
    </button>
  );
}

export default function HomePage() {
  const router = useRouter();

  const [screen, setScreen] = useState<Screen>("welcome");

  const [user, setUser] = useState<null | { id: string; email?: string | null }>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // 1) Učitaj session + slušaj promjene
  useEffect(() => {
    let alive = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      const u = data.session?.user ?? null;
      setUser(u ? { id: u.id, email: u.email } : null);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u ? { id: u.id, email: u.email } : null);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // 2) KLJUČNO: čim ima user, prebaci na MENU (da nakon login/register ne završi na welcome)
  useEffect(() => {
    if (user) {
      setScreen("menu");
      setMsg(null);
    }
  }, [user]);

  const modeLabel = useMemo(() => {
    if (user) return "Ranked (account)";
    return "Guest (unranked)";
  }, [user]);

  const startGuest = () => {
    setMsg(null);
    setScreen("menu");
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.refresh();
    setScreen("welcome");
    setMsg(null);
  };

  const openPhoto = () => {
    if (!user) {
      setMsg("Photo Quick is only playable when you are logged in / registered.");
      return;
    }
    router.push("/quick-photo");
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
        {/* HEADER */}
        <header className="pt-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[11px] text-white/70">
            <span className="h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_16px_rgba(59,130,246,0.95)]" />
            Global speed challenges
          </div>

          <h1 className="mt-4 text-5xl font-extrabold tracking-tight" style={{ letterSpacing: "-0.05em" }}>
            QUICK
          </h1>

          <p className="mt-2 text-[13px] leading-relaxed text-white/70">
            Be the fastest. Compete in real-time rounds and climb the global leaderboard.
          </p>

          {/* SAMO CHIPOVI - NE KLIK */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Chip label="Word Quick" />
            <Chip label="Photo Quick" />
            <Chip label="Leaderboard" />
          </div>
        </header>

        {/* CONTENT */}
        <section className="mt-7 space-y-3">
          {screen === "welcome" ? (
            <>
              <CardLink
                href="/auth?mode=login"
                title="Login"
                desc="Continue your ranked progress"
                variant="primary"
              />

              <CardLink
                href="/auth?mode=register"
                title="Register"
                desc="Create account for Ranked + Tournaments"
                variant="secondary"
              />

              {/*
              // GUEST MODE (HIDDEN FOR DEPLOY)
              <button
                onClick={startGuest}
                className="w-full rounded-2xl border border-white/12 bg-transparent px-5 py-4 text-left transition hover:bg-white/6 hover:border-white/22 active:scale-[0.98] active:opacity-95 touch-manipulation"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[16px] font-semibold text-white">Play as Guest</div>
                    <div className="mt-1 text-[12px] leading-snug text-white/65">
                      Practice & get a score (not in Ranked)
                    </div>
                  </div>
                  <div className="shrink-0 text-white/55">→</div>
                </div>
              </button>
              */}

              <div className="mt-5 rounded-2xl border border-white/12 bg-white/6 p-4">
                <div className="text-[12px] font-semibold text-white/85">How it works</div>
                <ul className="mt-2 space-y-2 text-[12px] leading-relaxed text-white/65">
                  <li>• Word Quick: you get 2 minutes to answer when the word drops.</li>
                  <li>• Photo Quick: submit a photo and get community votes.</li>
                  <li>• Guest is unranked. Accounts can join ranked later.</li>
                </ul>
              </div>
            </>
          ) : (
            <>
              <div className="mb-1 flex items-center justify-between">
                <div className="text-[13px] font-semibold text-white/90">Choose mode</div>
                <div className="rounded-full border border-blue-300/25 bg-blue-500/10 px-3 py-1 text-[11px] text-blue-200">
                  {modeLabel}
                </div>
              </div>

              {/* MENU: na mobitelu 2 stupca (kako želiš), ali kompaktno */}
              <div className="grid grid-cols-2 gap-3">
                <CardLink href="/quick-word" title="Word Quick" desc="Fastest wins" variant="primary" />

                {/* Photo quick: ako nije user -> locked */}
                {user ? (
                  <CardButton title="Photo Quick" desc="Snap & get voted" onClick={() => router.push("/quick-photo")} />
                ) : (
                  <CardButton title="Photo Quick" desc="Only for logged in" onClick={openPhoto} locked />
                )}

                <CardLink href="/leaderboard" title="Leaderboard" desc="World + Region" variant="secondary" />

                <CardLink href="/settings" title="Settings" desc="Theme & account" variant="ghost" />
              </div>

              {user ? (
                <button
                  onClick={logout}
                  className="mt-3 w-full rounded-2xl border border-white/12 bg-white/6 px-5 py-3 text-[14px] text-white/80 transition hover:bg-white/10 active:scale-[0.98] touch-manipulation"
                >
                  Logout
                </button>
              ) : (
                <button
                  className="mt-3 w-full rounded-2xl border border-white/12 bg-white/6 px-5 py-3 text-[14px] text-white/80 transition hover:bg-white/10 active:scale-[0.98] touch-manipulation"
                  onClick={() => {
                    setScreen("welcome");
                    setMsg(null);
                  }}
                >
                  ← Back
                </button>
              )}

              {msg ? (
                <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 p-4 text-[12px] leading-relaxed text-white/85">
                  {msg}
                  <div className="mt-3 flex gap-2">
                    <Link
                      href="/auth?mode=login"
                      className="rounded-xl border border-white/12 bg-white/6 px-3 py-2 text-[12px] text-white/85 transition hover:bg-white/10 active:scale-[0.98]"
                    >
                      Login
                    </Link>
                    <Link
                      href="/auth?mode=register"
                      className="rounded-xl border border-white/12 bg-white/6 px-3 py-2 text-[12px] text-white/85 transition hover:bg-white/10 active:scale-[0.98]"
                    >
                      Register
                    </Link>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>

        <footer className="mt-auto pb-2 pt-8 text-center text-[11px] text-white/40">
          Quick © {new Date().getFullYear()}
        </footer>
      </div>
    </main>
  );
}
