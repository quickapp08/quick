"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";

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

function Chip({ label, icon }: { label: string; icon: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[11px] text-white/75">
      <span className="text-[12px] leading-none">{icon}</span>
      <span>{label}</span>
    </span>
  );
}

function IconBadge({
  icon,
  tone,
}: {
  icon: string;
  tone?: "blue" | "slate" | "emerald" | "rose";
}) {
  const cls =
    tone === "emerald"
      ? "border-emerald-300/20 bg-emerald-500/12 text-emerald-100"
      : tone === "rose"
      ? "border-rose-300/20 bg-rose-500/12 text-rose-100"
      : tone === "blue"
      ? "border-blue-300/20 bg-blue-500/12 text-blue-100"
      : "border-white/12 bg-white/6 text-white/80";

  return (
    <div
      className={cx("grid h-10 w-10 place-items-center rounded-2xl border", cls)}
      aria-hidden="true"
    >
      <span className="text-[16px] leading-none">{icon}</span>
    </div>
  );
}

function CardLink({
  href,
  title,
  desc,
  icon,
  variant = "secondary",
  disabled = false,
}: {
  href: string;
  title: string;
  desc: string;
  icon?: string;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
}) {
  const base =
    "group relative overflow-hidden block w-full rounded-3xl px-4 py-4 text-left transition touch-manipulation " +
    "active:scale-[0.98] active:opacity-95 " +
    "hover:-translate-y-[1px] focus:outline-none focus:ring-2 focus:ring-blue-400/60";

  const styles = {
    primary:
      "border border-blue-300/25 bg-gradient-to-b from-blue-500/24 to-blue-500/10 " +
      "hover:border-blue-300/45 hover:shadow-[0_0_45px_rgba(59,130,246,0.30)]",
    secondary:
      "border border-white/12 bg-white/6 hover:border-white/22 hover:bg-white/10 " +
      "hover:shadow-[0_0_34px_rgba(59,130,246,0.14)]",
    ghost:
      "border border-white/12 bg-transparent hover:bg-white/6 hover:border-white/22",
  } as const;

  const content = (
    <div className="relative z-[2] flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {icon ? (
          <IconBadge
            icon={icon}
            tone={variant === "primary" ? "blue" : "slate"}
          />
        ) : null}
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-white/95">{title}</div>
          <div className="mt-1 text-[12px] leading-snug text-white/65">{desc}</div>
        </div>
      </div>
      <div className="shrink-0 text-white/45">→</div>
    </div>
  );

  const overlays =
    variant === "primary" ? (
      <>
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-blue-500/20 blur-2xl"
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
        <div
          className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-white/6"
          aria-hidden="true"
        />
      </>
    ) : (
      <div
        className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-white/5"
        aria-hidden="true"
      />
    );

  if (disabled) {
    return (
      <div
        className={cx(base, styles.secondary, "opacity-60 cursor-not-allowed")}
        aria-disabled
      >
        {overlays}
        {content}
      </div>
    );
  }

  return (
    <Link href={href} className={cx(base, styles[variant])}>
      {overlays}
      {content}
    </Link>
  );
}

function CardButton({
  title,
  desc,
  onClick,
  locked,
  icon,
}: {
  title: string;
  desc: string;
  onClick: () => void;
  locked?: boolean;
  icon?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "group relative overflow-hidden w-full rounded-3xl border border-white/12 bg-white/6 px-4 py-4 text-left transition touch-manipulation",
        "hover:border-white/22 hover:bg-white/10 hover:shadow-[0_0_34px_rgba(59,130,246,0.14)]",
        "active:scale-[0.98] active:opacity-95",
        locked ? "opacity-95" : ""
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-white/5"
        aria-hidden="true"
      />

      {locked ? (
        <>
          <div
            className="pointer-events-none absolute inset-0 bg-slate-950/20 backdrop-blur-[2px]"
            aria-hidden="true"
          />
        </>
      ) : null}

      <div
        className={cx(
          "pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full blur-2xl",
          locked ? "bg-rose-500/10" : "bg-blue-500/12"
        )}
        aria-hidden="true"
      />

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
        <div className="flex min-w-0 items-center gap-3">
          {icon ? <IconBadge icon={icon} tone={locked ? "rose" : "slate"} /> : null}
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-white/95">{title}</div>
            <div className="mt-1 text-[12px] leading-snug text-white/65">{desc}</div>
          </div>
        </div>
        <div className="shrink-0 text-white/45">→</div>
      </div>
    </button>
  );
}

export default function HomePage() {
  const router = useRouter();

  const [screen, setScreen] = useState<Screen>("welcome");

  const [user, setUser] = useState<null | { id: string; email?: string | null }>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [myStatus, setMyStatus] = useState<MyStatus | null>(null);

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

  useEffect(() => {
    if (user) {
      setScreen("menu");
      setMsg(null);
    }
  }, [user]);

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

  return (
    <main
      className={cx(
        // ✅ FIX: stop horizontal swipe/overflow on this screen
        "relative overflow-x-hidden overscroll-x-none touch-pan-y",
        "min-h-[100svh] w-full bg-gradient-to-b from-slate-950 via-slate-950 to-blue-950 text-white"
      )}
      style={{
        paddingTop: "max(env(safe-area-inset-top), 18px)",
        paddingBottom: "max(env(safe-area-inset-bottom), 18px)",
      }}
    >
      <div
        className={cx(
          // ✅ FIX: container also blocks horizontal overflow
          "mx-auto flex min-h-[100svh] max-w-md flex-col px-4 overflow-x-hidden"
        )}
      >
        <header className="pt-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[11px] text-white/70">
            <span className="h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_16px_rgba(59,130,246,0.95)]" />
            Global speed challenges
          </div>

          <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-[52px] w-[52px] place-items-center overflow-hidden rounded-2xl border border-white/12 bg-white/6">
                <Image
                  src="/quick-logo.png"
                  alt="Quick"
                  width={52}
                  height={52}
                  priority
                  className="h-[52px] w-[52px]"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[18px] font-extrabold tracking-tight text-white/95">
                      Quick
                    </div>

                    {user && myOk ? (
                      <div className="mt-1 flex flex-wrap gap-2">
                        <span className="inline-flex items-center rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[11px] text-white/80">
                          🌍 Rank: #{myOk.world_rank ?? "—"}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[11px] text-white/80">
                          ⚡ Points: {myOk.total_points}
                        </span>
                      </div>
                    ) : user ? (
                      <div className="mt-1 text-[11px] text-white/55">Loading rank…</div>
                    ) : null}
                  </div>

                  <div className="shrink-0 rounded-full border border-blue-300/25 bg-blue-500/10 px-3 py-1 text-[11px] font-semibold text-blue-200">
                    {modeLabel}
                  </div>
                </div>

                <p className="mt-2 text-[12px] leading-relaxed text-white/60">
                  Be the fastest. Compete in real-time rounds and climb the global leaderboard.
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Chip icon="⌨️" label="Word Quick" />
              <Chip icon="📸" label="Photo Quick" />
              <Chip icon="🏆" label="Leaderboard" />
              <Chip icon="⚙️" label="Settings" />
            </div>
          </div>
        </header>

        <section className="mt-5 space-y-3">
          {screen === "welcome" ? (
            <>
              <CardLink
                href="/auth?mode=login"
                title="Login"
                desc="Continue your ranked progress"
                icon="🔐"
                variant="primary"
              />
              <CardLink
                href="/auth?mode=register"
                title="Register"
                desc="Create account for Ranked + Tournaments"
                icon="✨"
                variant="secondary"
              />

              {/*
              <button onClick={startGuest} ...>Play as Guest</button>
              */}
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <CardLink
                  href="/quick-word"
                  title="Word Quick"
                  desc="Fastest wins"
                  icon="⌨️"
                  variant="primary"
                />

                {user ? (
                  <CardButton
                    title="Photo Quick"
                    desc="Snap & get voted"
                    icon="📸"
                    onClick={() => router.push("/quick-photo")}
                  />
                ) : (
                  <CardButton
                    title="Photo Quick"
                    desc="Only for logged in"
                    icon="📸"
                    onClick={openPhoto}
                    locked
                  />
                )}

                <CardLink
                  href="/leaderboard"
                  title="Leaderboard"
                  desc="World + Region"
                  icon="🏆"
                  variant="secondary"
                />
                <CardLink
                  href="/settings"
                  title="Settings"
                  desc="Theme & account"
                  icon="⚙️"
                  variant="ghost"
                />
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
                <div className="rounded-3xl border border-rose-400/25 bg-rose-500/10 p-4 text-[12px] leading-relaxed text-white/90">
                  <div className="flex items-start gap-3">
                    <IconBadge icon="⚠️" tone="rose" />
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold">Action required</div>
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

        <footer className="mt-auto pb-2 pt-7 text-center text-[11px] text-white/35">
          Quick © {new Date().getFullYear()}
        </footer>
      </div>
    </main>
  );
}
