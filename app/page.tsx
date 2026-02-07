"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getRank } from "@/lib/rank";

type Screen = "welcome" | "menu";

type MyStatus =
  | {
      ok: true;
      nickname: string;
      total_points: number;
      world_rank: number | null;
    }
  | {
      ok: false;
      error: string;
    };

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function IconBadge({
  icon,
  tone,
  size = "md",
}: {
  icon: string;
  tone?: "blue" | "slate" | "emerald" | "rose";
  size?: "sm" | "md";
}) {
  const cls =
    tone === "emerald"
      ? "border-emerald-300/20 bg-emerald-500/12 text-emerald-100"
      : tone === "rose"
      ? "border-rose-300/20 bg-rose-500/12 text-rose-100"
      : tone === "blue"
      ? "border-blue-300/20 bg-blue-500/12 text-blue-100"
      : "border-white/12 bg-white/6 text-white/85";

  const box = size === "sm" ? "h-9 w-9 rounded-2xl" : "h-10 w-10 rounded-2xl";
  const ico = size === "sm" ? "text-[15px]" : "text-[16px]";

  return (
    <div className={cx("grid place-items-center border", box, cls)} aria-hidden="true">
      <span className={cx("leading-none", ico)}>{icon}</span>
    </div>
  );
}

function StatPill({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[11px] font-semibold text-white/80">
      <span className="text-[12px] leading-none">{icon}</span>
      <span>{label}</span>
    </span>
  );
}

function MenuTile({
  title,
  icon,
  href,
  onClick,
  locked,
  variant = "secondary",
}: {
  title: string;
  icon: string;
  href?: string;
  onClick?: () => void;
  locked?: boolean;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const base =
    "group relative overflow-hidden w-full rounded-3xl border px-4 py-4 text-left transition touch-manipulation " +
    "active:scale-[0.98] active:opacity-95 focus:outline-none focus:ring-2 focus:ring-blue-400/60";

  const styles = {
    primary:
      "border border-blue-300/25 bg-gradient-to-b from-blue-500/22 to-blue-500/10 " +
      "hover:border-blue-300/45 hover:shadow-[0_0_45px_rgba(59,130,246,0.30)]",
    secondary:
      "border border-white/12 bg-white/6 hover:border-white/22 hover:bg-white/10 " +
      "hover:shadow-[0_0_34px_rgba(59,130,246,0.14)]",
    ghost: "border border-white/12 bg-transparent hover:bg-white/6 hover:border-white/22",
  } as const;

  const overlays =
    variant === "primary" ? (
      <>
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-blue-500/16 blur-2xl"
          aria-hidden="true"
        />
        <div
          className={cx(
            "pointer-events-none absolute -left-40 top-0 h-full w-40 rotate-[20deg]",
            "bg-gradient-to-r from-transparent via-white/14 to-transparent blur-xl",
            "transition-transform duration-700 ease-out",
            "group-hover:translate-x-[520px]"
          )}
          aria-hidden="true"
        />
        <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-white/6" aria-hidden="true" />
      </>
    ) : (
      <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-white/5" aria-hidden="true" />
    );

  const content = (
    <>
      {overlays}

      {locked ? (
        <>
          <div className="pointer-events-none absolute inset-0 bg-slate-950/18 backdrop-blur-[2px]" aria-hidden="true" />
          <div
            className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-2 rounded-full border border-rose-300/20 bg-rose-500/10 px-2.5 py-1 text-[10px] font-semibold text-rose-100"
            aria-hidden="true"
          >
            🔒 Locked
          </div>
        </>
      ) : null}

      <div className="relative z-[2] flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <IconBadge icon={icon} tone={locked ? "rose" : variant === "primary" ? "blue" : "slate"} />
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold text-white/95">{title}</div>
          </div>
        </div>
        <div className="shrink-0 text-white/45">→</div>
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cx(base, styles[variant])}>
        {content}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={cx(base, styles[variant])}>
      {content}
    </button>
  );
}

export default function HomePage() {
  const router = useRouter();

  const [screen, setScreen] = useState<Screen>("welcome");

  const [user, setUser] = useState<null | { id: string; email?: string | null }>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [myStatus, setMyStatus] = useState<MyStatus | null>(null);

  // session + changes (no logic changes)
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

  // go to menu when logged (no logic changes)
  useEffect(() => {
    if (user) {
      setScreen("menu");
      setMsg(null);
    }
  }, [user]);

  // load status (no logic changes)
  useEffect(() => {
    let alive = true;

    async function loadMyStatus() {
      if (!user) {
        setMyStatus(null);
        return;
      }

      const res = await supabase.rpc("get_my_status");
      if (!alive) return;

      if (res.error) {
        setMyStatus({ ok: false, error: res.error.message });
        return;
      }

      setMyStatus(res.data as MyStatus);
    }

    loadMyStatus();
    const t = setInterval(loadMyStatus, 15000);

    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [user]);

  const modeLabel = useMemo(() => {
    if (user) return "Ranked";
    return "Guest";
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
    setMyStatus(null);
  };

  const openPhoto = () => {
    if (!user) {
      setMsg("Photo Quick is only playable when you are logged in / registered.");
      return;
    }
    router.push("/quick-photo");
  };

  const myOk = myStatus && myStatus.ok === true ? myStatus : null;

  // header name (prefer nickname)
  const headerName = useMemo(() => {
    if (!user) return "Guest";
    if (myOk?.nickname) return myOk.nickname;
    return user.email ? String(user.email).split("@")[0] : "Player";
  }, [user, myOk?.nickname, user?.email]);

  return (
    <main
      className="min-h-[100svh] w-full bg-gradient-to-b from-slate-950 via-slate-950 to-blue-950 text-white"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 18px)",
        paddingBottom: "max(env(safe-area-inset-bottom), 18px)",
      }}
    >
      <div className="mx-auto flex min-h-[100svh] max-w-md flex-col px-4">
        {/* HEADER (compact, clean) */}
        <header className="pt-2">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[11px] text-white/70">
              <span className="h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_16px_rgba(59,130,246,0.95)]" />
              Global speed challenges
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-blue-300/25 bg-blue-500/10 px-3 py-1 text-[11px] font-semibold text-blue-200">
              {modeLabel}
            </div>
          </div>

          {/* Profile bar */}
          <div className="mt-3 rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] text-white/55">Player</div>
                <div className="mt-0.5 truncate text-[18px] font-extrabold tracking-tight text-white/95">
                  {headerName}
                </div>

                {user ? (
                  myOk ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <StatPill icon="🌍" label={`#${myOk.world_rank ?? "—"}`} />
                      <StatPill icon="⚡" label={`${myOk.total_points} pts`} />
                    </div>
                  ) : (
                    <div className="mt-2 text-[11px] text-white/55">Loading rank…</div>
                  )
                ) : null}
              </div>

              {/* Logo (small + not like profile avatar) */}
              <div className="shrink-0">
                <div className="relative grid h-12 w-12 place-items-center rounded-2xl border border-white/12 bg-white/6">
                  <div
                    className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-blue-500/16 blur-2xl"
                    aria-hidden="true"
                  />
                  <Image
                    src="/quick-logo.png"
                    alt="Quick"
                    width={44}
                    height={44}
                    priority
                    className="h-11 w-11 opacity-95"
                  />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <section className="mt-5 space-y-3">
          {screen === "welcome" ? (
            <>
              <Link
                href="/auth?mode=login"
                className={cx(
                  "group relative overflow-hidden block w-full rounded-3xl border border-blue-300/25",
                  "bg-gradient-to-b from-blue-500/22 to-blue-500/10",
                  "px-4 py-4 text-left transition touch-manipulation",
                  "hover:-translate-y-[1px] hover:border-blue-300/45 hover:shadow-[0_0_45px_rgba(59,130,246,0.30)]",
                  "active:scale-[0.98] active:opacity-95 focus:outline-none focus:ring-2 focus:ring-blue-400/60"
                )}
              >
                <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-blue-500/16 blur-2xl" aria-hidden="true" />
                <div
                  className={cx(
                    "pointer-events-none absolute -left-40 top-0 h-full w-40 rotate-[20deg]",
                    "bg-gradient-to-r from-transparent via-white/14 to-transparent blur-xl",
                    "transition-transform duration-700 ease-out",
                    "group-hover:translate-x-[520px]"
                  )}
                  aria-hidden="true"
                />
                <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-white/6" aria-hidden="true" />

                <div className="relative z-[2] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <IconBadge icon="🔐" tone="blue" />
                    <div className="text-[15px] font-semibold text-white/95">Login</div>
                  </div>
                  <div className="text-white/45">→</div>
                </div>
              </Link>

              <Link
                href="/auth?mode=register"
                className={cx(
                  "group relative overflow-hidden block w-full rounded-3xl border border-white/12 bg-white/6",
                  "px-4 py-4 text-left transition touch-manipulation",
                  "hover:-translate-y-[1px] hover:border-white/22 hover:bg-white/10 hover:shadow-[0_0_34px_rgba(59,130,246,0.14)]",
                  "active:scale-[0.98] active:opacity-95 focus:outline-none focus:ring-2 focus:ring-blue-400/60"
                )}
              >
                <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-white/5" aria-hidden="true" />
                <div
                  className={cx(
                    "pointer-events-none absolute -left-32 top-0 h-full w-32 rotate-[20deg]",
                    "bg-gradient-to-r from-transparent via-white/10 to-transparent blur-xl",
                    "transition-transform duration-700 ease-out",
                    "group-hover:translate-x-[520px]"
                  )}
                  aria-hidden="true"
                />

                <div className="relative z-[2] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <IconBadge icon="✨" tone="slate" />
                    <div className="text-[15px] font-semibold text-white/95">Register</div>
                  </div>
                  <div className="text-white/45">→</div>
                </div>
              </Link>

              {/*
              // Guest mode hidden for deploy (kept)
              <button onClick={startGuest} ...>Play as Guest</button>
              */}
            </>
          ) : (
            <>
              {/* MENU: no descriptions, no "choose mode" */}
              <div className="grid grid-cols-2 gap-3">
                <MenuTile title="Word Quick" icon="⌨️" href="/quick-word" variant="primary" />

                {user ? (
                  <MenuTile title="Photo Quick" icon="📸" onClick={() => router.push("/quick-photo")} />
                ) : (
                  <MenuTile title="Photo Quick" icon="📸" onClick={openPhoto} locked />
                )}

                <MenuTile title="Leaderboard" icon="🏆" href="/leaderboard" />
                <MenuTile title="Settings" icon="⚙️" href="/settings" variant="ghost" />
              </div>

              {user ? (
                <button
                  onClick={logout}
                  className="mt-3 w-full rounded-2xl border border-white/12 bg-white/6 px-5 py-3 text-[13px] text-white/80 transition hover:bg-white/10 active:scale-[0.98] touch-manipulation"
                >
                  Logout
                </button>
              ) : (
                <button
                  className="mt-3 w-full rounded-2xl border border-white/12 bg-white/6 px-5 py-3 text-[13px] text-white/80 transition hover:bg-white/10 active:scale-[0.98] touch-manipulation"
                  onClick={() => {
                    setScreen("welcome");
                    setMsg(null);
                  }}
                >
                  ← Back
                </button>
              )}

              {msg ? (
                <div className="rounded-3xl border border-rose-400/25 bg-rose-500/10 p-4 text-[12px] leading-relaxed text-white/90">
                  <div className="flex items-start gap-3">
                    <IconBadge icon="⚠️" tone="rose" size="sm" />
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold">Login required</div>
                      <div className="mt-1 text-white/80">{msg}</div>

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
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>

        <footer className="mt-auto pb-2 pt-6 text-center text-[11px] text-white/35">
          Quick © {new Date().getFullYear()}
        </footer>
      </div>
    </main>
  );
}
