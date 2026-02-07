"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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

/* ---------------- UI only ---------------- */

function HeaderPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/75">
      {children}
    </span>
  );
}

function IconSquare({ icon }: { icon: string }) {
  return (
    <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/6 text-[18px] shadow-[0_10px_25px_rgba(0,0,0,0.28)]">
      <span className="leading-none">{icon}</span>
    </div>
  );
}

function NotifButton({ count = 0 }: { count?: number }) {
  return (
    <button
      type="button"
      className={cx(
        "relative grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/6",
        "shadow-[0_12px_30px_rgba(0,0,0,0.35)] transition",
        "active:scale-[0.98] hover:bg-white/10"
      )}
      aria-label="Notifications"
      title="Notifications (coming soon)"
    >
      <span className="text-[16px] leading-none">🔔</span>
      {count > 0 ? (
        <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full border border-blue-300/25 bg-blue-500/20 px-1 text-[11px] font-extrabold text-blue-100">
          {count > 99 ? "99+" : count}
        </span>
      ) : (
        // subtle dot to show "place for notifications"
        <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border border-white/20 bg-white/10" />
      )}
    </button>
  );
}

function BigTile({
  titleTop,
  titleBottom,
  icon,
  href,
  onClick,
  locked,
  primary,
}: {
  titleTop: string;
  titleBottom: string;
  icon: string;
  href?: string;
  onClick?: () => void;
  locked?: boolean;
  primary?: boolean;
}) {
  const base =
    "group relative w-full overflow-hidden rounded-3xl border px-4 py-4 text-left transition touch-manipulation " +
    "active:scale-[0.98] active:opacity-95";

  const surface = primary
    ? "border-blue-300/20 bg-gradient-to-b from-blue-500/18 to-white/5 hover:shadow-[0_0_55px_rgba(59,130,246,0.26)]"
    : "border-white/10 bg-white/6 hover:bg-white/10 hover:border-white/15";

  const inner = (
    <>
      <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-white/7" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/9 blur-2xl" aria-hidden="true" />
      <div
        className={cx(
          "pointer-events-none absolute -left-40 top-0 h-full w-40 rotate-[18deg]",
          "bg-gradient-to-r from-transparent via-white/12 to-transparent blur-xl",
          "transition-transform duration-700 ease-out",
          "group-hover:translate-x-[520px]"
        )}
        aria-hidden="true"
      />
      {locked ? (
        <div
          className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-rose-300/20 bg-rose-500/10 px-2.5 py-1 text-[10px] font-semibold text-rose-100"
          aria-hidden="true"
        >
          🔒
        </div>
      ) : null}

      <div className="relative z-[2] flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <IconSquare icon={icon} />
          <div className="min-w-0">
            {/* NO truncate, NO clamp, must show full words */}
            <div className="text-[16px] font-extrabold leading-tight tracking-tight text-white/95">
              {titleTop}
            </div>
            <div className="text-[16px] font-extrabold leading-tight tracking-tight text-white/95">
              {titleBottom}
            </div>
          </div>
        </div>
        <div className="shrink-0 text-white/35 transition group-hover:text-white/60">›</div>
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cx(base, surface)}>
        {inner}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={cx(base, surface)} type="button">
      {inner}
    </button>
  );
}

function SmallTile({
  title,
  icon,
  href,
  onClick,
  locked,
}: {
  title: string;
  icon: string;
  href?: string;
  onClick?: () => void;
  locked?: boolean;
}) {
  const base =
    "group relative w-full overflow-hidden rounded-3xl border px-4 py-4 text-left transition touch-manipulation " +
    "active:scale-[0.98] active:opacity-95";

  const surface = "border-white/10 bg-white/6 hover:bg-white/10 hover:border-white/15";

  const inner = (
    <>
      <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-white/7" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-white/8 blur-2xl" aria-hidden="true" />

      {locked ? (
        <div
          className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-rose-300/20 bg-rose-500/10 px-2.5 py-1 text-[10px] font-semibold text-rose-100"
          aria-hidden="true"
        >
          🔒
        </div>
      ) : null}

      <div className="relative z-[2] flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <IconSquare icon={icon} />
          {/* one line, but NO cutting: allow wrap if needed */}
          <div className="min-w-0 text-[14px] font-extrabold leading-tight tracking-tight text-white/95">
            {title}
          </div>
        </div>
        <div className="shrink-0 text-white/35 transition group-hover:text-white/60">›</div>
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cx(base, surface)}>
        {inner}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={cx(base, surface)} type="button">
      {inner}
    </button>
  );
}

function ActionLink({
  href,
  title,
  icon,
  primary,
}: {
  href: string;
  title: string;
  icon: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "group relative flex w-full items-center justify-between gap-3 rounded-3xl border px-5 py-4 transition",
        "active:scale-[0.98] active:opacity-95",
        primary
          ? "border-blue-300/20 bg-gradient-to-b from-blue-500/18 to-white/5 hover:shadow-[0_0_45px_rgba(59,130,246,0.28)]"
          : "border-white/10 bg-white/6 hover:bg-white/10"
      )}
    >
      <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-white/6" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/8 blur-2xl" aria-hidden="true" />
      <div
        className={cx(
          "pointer-events-none absolute -left-40 top-0 h-full w-40 rotate-[18deg]",
          "bg-gradient-to-r from-transparent via-white/12 to-transparent blur-xl",
          "transition-transform duration-700 ease-out",
          "group-hover:translate-x-[520px]"
        )}
        aria-hidden="true"
      />

      <div className="relative z-[2] flex items-center gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/6 text-[18px] shadow-[0_10px_25px_rgba(0,0,0,0.28)]">
          {icon}
        </div>
        <div className="text-[16px] font-extrabold tracking-tight text-white/95">{title}</div>
      </div>

      <div className="relative z-[2] text-white/35 transition group-hover:text-white/60">›</div>
    </Link>
  );
}

/* ---------------- PAGE (LOGIC UNCHANGED) ---------------- */

export default function HomePage() {
  const router = useRouter();

  const [screen, setScreen] = useState<Screen>("welcome");
  const [user, setUser] = useState<null | { id: string; email?: string | null }>(null);
  const [myStatus, setMyStatus] = useState<MyStatus | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u ? { id: u.id, email: u.email } : null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user ?? null;
      setUser(u ? { id: u.id, email: u.email } : null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      setScreen("menu");
      setMsg(null);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setMyStatus(null);
      return;
    }

    let alive = true;

    const load = async () => {
      const res = await supabase.rpc("get_my_status");
      if (!alive) return;
      if (res.error) return;
      setMyStatus(res.data as MyStatus);
    };

    load();
    const t = setInterval(load, 15000);

    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [user]);

  const modeLabel = useMemo(() => (user ? "Ranked" : "Guest"), [user]);

  const headerName = useMemo(() => {
    if (!user) return "Guest";
    if (myStatus?.ok && myStatus.nickname) return myStatus.nickname;
    return user.email?.split("@")[0] ?? "Player";
  }, [user, myStatus]);

  const logout = async () => {
    await supabase.auth.signOut();
    router.refresh();
    setScreen("welcome");
    setMsg(null);
    setMyStatus(null);
  };

  const openPhoto = () => {
    if (!user) {
      setMsg("Photo Quick je dostupan samo za ulogirane korisnike.");
      return;
    }
    router.push("/quick-photo");
  };

  const myOk = myStatus && myStatus.ok === true ? myStatus : null;

  return (
    <main
      className="min-h-[100svh] w-full text-white"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 14px)",
        paddingBottom: "max(env(safe-area-inset-bottom), 14px)",
      }}
    >
      {/* background */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-slate-950 via-slate-950 to-blue-950" />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(1200px_700px_at_50%_-10%,rgba(59,130,246,0.18),transparent_55%)]" />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(900px_600px_at_0%_30%,rgba(255,255,255,0.06),transparent_60%)]" />

      <div className="mx-auto flex min-h-[100svh] max-w-md flex-col px-4">
        {/* top row */}
        <div className="pt-1 flex items-center justify-between">
          <HeaderPill>
            <span className="h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_16px_rgba(59,130,246,0.95)]" />
            Global
          </HeaderPill>

          <div className="flex items-center gap-2">
            <NotifButton count={0} />
            <HeaderPill>{modeLabel}</HeaderPill>
          </div>
        </div>

        {/* header card */}
        <header className="mt-3 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.38)]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-white/55">Username</div>
              <div className="mt-0.5 truncate text-[20px] font-extrabold tracking-tight text-white/95">
                {headerName}
              </div>

              {user ? (
                myOk ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <HeaderPill>🌍 #{myOk.world_rank ?? "—"}</HeaderPill>
                    <HeaderPill>⚡ {myOk.total_points} pts</HeaderPill>
                  </div>
                ) : (
                  <div className="mt-2 text-[11px] text-white/45">Loading…</div>
                )
              ) : null}
            </div>

            <div className="shrink-0">
              <div className="relative grid h-12 w-12 place-items-center rounded-2xl border border-white/12 bg-white/6">
                <div className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-blue-500/18 blur-2xl" />
                <Image src="/quick-logo.png" alt="Quick" width={44} height={44} className="opacity-95" />
              </div>
            </div>
          </div>
        </header>

        {/* content */}
        <section className="mt-5 space-y-3">
          {screen === "welcome" ? (
            <>
              <ActionLink href="/auth?mode=login" title="Login" icon="🔐" primary />
              <ActionLink href="/auth?mode=register" title="Register" icon="✨" />
            </>
          ) : (
            <>
              {/* Big row: Word + Photo (same row as you asked) */}
              <div className="grid grid-cols-2 gap-3">
                <BigTile titleTop="Word" titleBottom="Quick" icon="⌨️" href="/quick-word" primary />
                {user ? (
                  <BigTile titleTop="Photo" titleBottom="Quick" icon="📸" onClick={() => router.push("/quick-photo")} />
                ) : (
                  <BigTile titleTop="Photo" titleBottom="Quick" icon="📸" onClick={openPhoto} locked />
                )}
              </div>

              {/* Actions below */}
              <div className="grid grid-cols-2 gap-3">
                <SmallTile title="Create Own" icon="👥" onClick={() => {}} locked />
                <SmallTile title="Tournaments" icon="🏟️" onClick={() => {}} locked />
                <SmallTile title="Leaderboard" icon="🏆" href="/leaderboard" />
                <SmallTile title="Settings" icon="⚙️" href="/settings" />
              </div>

              <button
                onClick={logout}
                className={cx(
                  "mt-3 w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-3",
                  "text-[13px] font-semibold text-white/75 transition",
                  "hover:bg-white/10 active:scale-[0.98]"
                )}
                type="button"
              >
                ⎋ Logout
              </button>

              {msg ? (
                <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 p-3 text-[12px] text-white/90">
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

        <footer className="mt-auto pb-2 pt-6 text-center text-[11px] text-white/30">
          Quick © {new Date().getFullYear()}
        </footer>
      </div>
    </main>
  );
}
