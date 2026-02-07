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
  | { ok: false; error: string };

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/* -------------------- UI atoms (no logic changes) -------------------- */

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/75">
      {children}
    </span>
  );
}

function IconBadge({
  icon,
  tone = "slate",
}: {
  icon: string;
  tone?: "blue" | "slate" | "rose";
}) {
  const toneCls =
    tone === "blue"
      ? "border-blue-300/18 bg-blue-500/12 text-blue-100"
      : tone === "rose"
      ? "border-rose-300/18 bg-rose-500/12 text-rose-100"
      : "border-white/10 bg-white/6 text-white/85";

  return (
    <div
      className={cx(
        "grid h-11 w-11 place-items-center rounded-2xl border shadow-[0_14px_38px_rgba(0,0,0,0.40)] backdrop-blur-[6px]",
        toneCls
      )}
      aria-hidden="true"
    >
      <span className="text-[17px] leading-none">{icon}</span>
    </div>
  );
}

function IconButton({
  icon,
  badge,
  onClick,
  ariaLabel,
}: {
  icon: string;
  badge?: number;
  onClick?: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cx(
        "relative grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5",
        "shadow-[0_14px_38px_rgba(0,0,0,0.38)] backdrop-blur-[6px] transition",
        "hover:bg-white/8 active:scale-[0.98]"
      )}
    >
      <span className="text-[16px] leading-none">{icon}</span>
      {typeof badge === "number" ? (
        <span
          className={cx(
            "absolute -right-1 -top-1 min-w-[18px] rounded-full px-1.5 py-0.5 text-[10px] font-extrabold",
            "border border-blue-300/20 bg-blue-500/25 text-blue-100"
          )}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function Surface({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cx(
        "rounded-3xl border border-white/10 bg-white/[0.06]",
        "shadow-[0_22px_70px_rgba(0,0,0,0.45)] backdrop-blur-[7px]"
      )}
    >
      {children}
    </div>
  );
}

function ActionRow({
  href,
  title,
  icon,
  variant = "secondary",
}: {
  href: string;
  title: string;
  icon: string;
  variant?: "primary" | "secondary";
}) {
  const variantCls =
    variant === "primary"
      ? "border-blue-300/18 bg-gradient-to-b from-blue-500/20 to-white/5 hover:shadow-[0_0_55px_rgba(59,130,246,0.26)]"
      : "border-white/10 bg-white/6 hover:bg-white/10 hover:shadow-[0_0_36px_rgba(59,130,246,0.12)]";

  return (
    <Link
      href={href}
      className={cx(
        "group relative flex w-full items-center justify-between gap-3 rounded-3xl border px-5 py-5 transition",
        "active:scale-[0.98] active:opacity-95",
        variantCls
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-white/7"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/10 blur-2xl"
        aria-hidden="true"
      />
      <div
        className={cx(
          "pointer-events-none absolute -left-44 top-0 h-full w-44 rotate-[18deg]",
          "bg-gradient-to-r from-transparent via-white/12 to-transparent blur-xl",
          "transition-transform duration-700 ease-out",
          "group-hover:translate-x-[560px]"
        )}
        aria-hidden="true"
      />

      <div className="relative z-[2] flex items-center gap-4">
        <IconBadge icon={icon} tone={variant === "primary" ? "blue" : "slate"} />
        <div className="text-[18px] font-extrabold tracking-tight text-white/95">
          {title}
        </div>
      </div>

      <div className="relative z-[2] text-white/35 transition group-hover:text-white/60">
        ›
      </div>
    </Link>
  );
}

function GameTile({
  title,
  icon,
  href,
  onClick,
  primary,
  locked,
}: {
  title: string;
  icon: string;
  href?: string;
  onClick?: () => void;
  primary?: boolean;
  locked?: boolean;
}) {
  const surface = primary
    ? "border-blue-300/18 bg-gradient-to-b from-blue-500/18 to-white/5"
    : "border-white/10 bg-white/6";

  const base = cx(
    "group relative w-full overflow-hidden rounded-3xl border transition touch-manipulation",
    "shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-[6px]",
    "hover:bg-white/8 active:scale-[0.98] active:opacity-95",
    surface
  );

  const inner = (
    <>
      <div
        className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-white/7"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/10 blur-2xl"
        aria-hidden="true"
      />

      {locked ? (
        <div
          className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-2 rounded-full border border-rose-300/18 bg-rose-500/10 px-2.5 py-1 text-[11px] font-extrabold text-rose-100"
          aria-hidden="true"
        >
          🔒
        </div>
      ) : null}

      <div className="relative z-[2] flex items-center justify-between gap-3 p-5">
        <div className="flex items-center gap-4 min-w-0">
          <IconBadge icon={icon} tone={primary ? "blue" : "slate"} />
          <div className="min-w-0">
            {/* ✅ full word visible: no truncation */}
            <div className="whitespace-nowrap text-[18px] font-extrabold tracking-tight text-white/95">
              {title}
            </div>
          </div>
        </div>
        <div className="text-white/35 transition group-hover:text-white/60">›</div>
      </div>
    </>
  );

  if (href) return <Link href={href} className={base}>{inner}</Link>;
  return (
    <button type="button" onClick={onClick} className={base}>
      {inner}
    </button>
  );
}

function ListCard({
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
  const base = cx(
    "group relative w-full overflow-hidden rounded-3xl border border-white/10 bg-white/6",
    "shadow-[0_18px_55px_rgba(0,0,0,0.40)] backdrop-blur-[6px] transition",
    "hover:bg-white/10 active:scale-[0.98] active:opacity-95"
  );

  const inner = (
    <>
      <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-white/7" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-white/8 blur-2xl" aria-hidden="true" />

      {locked ? (
        <div
          className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-2 rounded-full border border-rose-300/18 bg-rose-500/10 px-3 py-1 text-[11px] font-extrabold text-rose-100"
          aria-hidden="true"
        >
          🔒 Locked
        </div>
      ) : null}

      <div className="relative z-[2] flex items-center justify-between gap-3 p-5">
        <div className="flex items-center gap-4 min-w-0">
          <IconBadge icon={icon} />
          <div className="text-[18px] font-extrabold tracking-tight text-white/95">
            {title}
          </div>
        </div>
        <div className="text-white/35 transition group-hover:text-white/60">›</div>
      </div>
    </>
  );

  if (href) return <Link href={href} className={base}>{inner}</Link>;
  return (
    <button type="button" onClick={onClick} className={base}>
      {inner}
    </button>
  );
}

/* -------------------- Page (logic unchanged) -------------------- */

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
    } else {
      setMyStatus(null);
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
      className="min-h-[100svh] w-full bg-gradient-to-b from-slate-950 via-slate-950 to-blue-950 text-white"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 18px)",
        paddingBottom: "max(env(safe-area-inset-bottom), 18px)",
      }}
    >
      <div className="mx-auto flex min-h-[100svh] max-w-md flex-col px-4">
        {/* TOP BAR */}
        <header className="pt-2">
          <div className="flex items-center justify-between">
            <Pill>
              <span className="h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_16px_rgba(59,130,246,0.95)]" />
              Global
            </Pill>

            {/* ✅ bell only when logged in */}
            {user ? (
              <IconButton
                icon="🔔"
                badge={0}
                ariaLabel="Notifications"
                onClick={() => {
                  // UI only for later
                }}
              />
            ) : (
              <div className="h-10 w-10" />
            )}
          </div>

          {/* ✅ Logged-in: centered game name, no logo */}
          {user ? (
            <div className="mt-4 text-center">
              <div className="text-[24px] font-extrabold tracking-tight text-white/95">
                Quick
              </div>
            </div>
          ) : null}

          {/* ✅ Welcome: ONLY title (not a selectable card), no extra empty box */}
          {!user ? (
            <div className="mt-5 flex items-center justify-center gap-3">
              <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white/6 shadow-[0_14px_38px_rgba(0,0,0,0.40)]">
                <Image
                  src="/quick-logo.png"
                  alt="Quick"
                  width={48}
                  height={48}
                  priority
                  className="h-[48px] w-[48px]"
                />
              </div>
              <div className="text-[26px] font-extrabold tracking-tight text-white/95">
                Quick
              </div>
            </div>
          ) : null}

          {/* Player card (logged in) */}
          {user ? (
            <div className="mt-4">
              <Surface>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold text-white/55">Player</div>
                      <div className="mt-1 text-[30px] font-extrabold tracking-tight text-white/95">
                        {myOk?.nickname ?? "…"}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12px] font-semibold text-white/80">
                          🌍 #{myOk?.world_rank ?? "—"}
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12px] font-semibold text-white/80">
                          ⚡ {myOk?.total_points ?? 0} pts
                        </span>
                      </div>
                    </div>

                    {/* ✅ Avatar slot (UI only, later connect to profile avatar) */}
                    <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/5 shadow-[0_14px_38px_rgba(0,0,0,0.40)]">
                      <span className="text-[18px]">👤</span>
                    </div>
                  </div>
                </div>
              </Surface>
            </div>
          ) : null}
        </header>

        {/* CONTENT */}
        <section className="mt-5 space-y-4">
          {screen === "welcome" ? (
            <>
              <ActionRow href="/auth?mode=login" title="Login" icon="🔐" variant="primary" />
              <ActionRow href="/auth?mode=register" title="Register" icon="✨" variant="secondary" />

              {msg ? (
                <div className="rounded-3xl border border-rose-400/25 bg-rose-500/10 p-4 text-[12px] text-white/85">
                  {msg}
                </div>
              ) : null}
            </>
          ) : (
            <>
              {/* ✅ Word + Photo in one row */}
              <div className="grid grid-cols-2 gap-3">
                <GameTile title="Word Quick" icon="⌨️" href="/quick-word" primary />
                {user ? (
                  <GameTile title="Photo Quick" icon="📸" onClick={() => router.push("/quick-photo")} />
                ) : (
                  <GameTile title="Photo Quick" icon="📸" onClick={openPhoto} locked />
                )}
              </div>

              {/* ✅ Everything else below, FULL cards (no missing “kucica”) */}
              <div className="space-y-3">
                <ListCard title="Create Own" icon="👥" locked />
                <ListCard title="Tournaments" icon="🏟️" locked />
                <ListCard title="Leaderboard" icon="🏆" href="/leaderboard" />
                <ListCard title="Settings" icon="⚙️" href="/settings" />
              </div>

              <button
                onClick={logout}
                className={cx(
                  "mt-2 w-full rounded-3xl border border-white/10 bg-white/6 px-5 py-4",
                  "shadow-[0_18px_55px_rgba(0,0,0,0.40)] backdrop-blur-[6px]",
                  "text-[16px] font-extrabold text-white/90 transition",
                  "hover:bg-white/10 active:scale-[0.98]"
                )}
              >
                ⟲ Logout
              </button>

              {msg ? (
                <div className="rounded-3xl border border-rose-400/25 bg-rose-500/10 p-4 text-[12px] text-white/90">
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

        <footer className="mt-auto pb-2 pt-8 text-center text-[11px] text-white/35">
          Quick © {new Date().getFullYear()}
        </footer>
      </div>
    </main>
  );
}
