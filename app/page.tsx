"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
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

/* -------------------- UI bits -------------------- */

function TopPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/75 backdrop-blur-[6px]">
      {children}
    </span>
  );
}

function IconBtn({
  icon,
  badge,
  ariaLabel,
  onClick,
}: {
  icon: string;
  badge?: number;
  ariaLabel: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cx(
        "relative grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5",
        "shadow-[0_14px_40px_rgba(0,0,0,0.42)] backdrop-blur-[8px] transition",
        "hover:bg-white/8 active:scale-[0.98]"
      )}
    >
      <span className="text-[16px] leading-none">{icon}</span>
      {typeof badge === "number" ? (
        <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full border border-blue-300/20 bg-blue-500/25 px-1.5 py-0.5 text-[10px] font-extrabold text-blue-100">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function GlassCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-3xl border border-white/10 bg-white/[0.06]",
        "shadow-[0_22px_70px_rgba(0,0,0,0.46)] backdrop-blur-[10px]",
        className
      )}
    >
      {children}
    </div>
  );
}

function MiniChip({ icon, text }: { icon: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12px] font-semibold text-white/80 backdrop-blur-[8px]">
      <span className="text-[14px] leading-none">{icon}</span>
      <span>{text}</span>
    </span>
  );
}

/** Big tile (Word/Photo) */
function ModeTile({
  title,
  icon,
  href,
  onClick,
  tone = "dark",
}: {
  title: string;
  icon: string;
  href?: string;
  onClick?: () => void;
  tone?: "blue" | "dark";
}) {
  const base = cx(
    "relative w-full rounded-3xl border overflow-hidden",
    "shadow-[0_18px_52px_rgba(0,0,0,0.42)] backdrop-blur-[10px] transition",
    "active:scale-[0.98] active:opacity-95 hover:bg-white/10"
  );

  const toneCls =
    tone === "blue"
      ? "border-blue-300/16 bg-gradient-to-b from-blue-500/18 to-white/5"
      : "border-white/10 bg-white/6";

  const inner = (
    <>
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.10] via-transparent to-transparent"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-blue-500/14 blur-2xl"
        aria-hidden="true"
      />
      <div className="relative z-[2] flex items-center justify-between gap-3 px-4 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/6 shadow-[0_12px_34px_rgba(0,0,0,0.35)]">
            <span className="text-[18px] leading-none">{icon}</span>
          </div>
          <div className="min-w-0">
            <div className="text-[16px] font-extrabold tracking-tight text-white/95 leading-tight">
              {title}
            </div>
          </div>
        </div>
        <span className="text-white/35 text-[18px] leading-none">›</span>
      </div>
    </>
  );

  if (href) return <Link href={href} className={cx(base, toneCls)}>{inner}</Link>;
  return (
    <button type="button" onClick={onClick} className={cx(base, toneCls)}>
      {inner}
    </button>
  );
}

/** Compact tile (Create/Tournaments) - NO LOCKED BADGE */
function CompactTile({
  title,
  icon,
  onClick,
  disabledLook,
}: {
  title: string;
  icon: string;
  onClick?: () => void;
  disabledLook?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "relative w-full rounded-3xl border overflow-hidden px-4 py-4 text-left",
        "shadow-[0_16px_48px_rgba(0,0,0,0.42)] backdrop-blur-[10px] transition",
        "active:scale-[0.98] active:opacity-95 hover:bg-white/10",
        disabledLook ? "border-white/8 bg-white/4 opacity-80" : "border-white/10 bg-white/6"
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.10] via-transparent to-transparent"
        aria-hidden="true"
      />
      <div className="relative z-[2] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cx(
              "grid h-11 w-11 place-items-center rounded-2xl border bg-white/6 shadow-[0_12px_34px_rgba(0,0,0,0.35)]",
              disabledLook ? "border-white/8" : "border-white/10"
            )}
          >
            <span className="text-[18px] leading-none">{icon}</span>
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-extrabold tracking-tight text-white/95 leading-tight">
              {title}
            </div>
          </div>
        </div>

        <span className="text-white/35 text-[18px] leading-none">›</span>
      </div>
    </button>
  );
}

function IconOnlyLink({
  href,
  icon,
  ariaLabel,
}: {
  href: string;
  icon: string;
  ariaLabel: string;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={cx(
        "grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/6",
        "shadow-[0_16px_48px_rgba(0,0,0,0.42)] backdrop-blur-[10px] transition",
        "hover:bg-white/10 active:scale-[0.98]"
      )}
    >
      <span className="text-[18px] leading-none">{icon}</span>
    </Link>
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
      setScreen("welcome");
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
      className="relative min-h-[100svh] w-full text-white bg-gradient-to-b from-slate-950 via-slate-950 to-blue-950"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 18px)",
        paddingBottom: "max(env(safe-area-inset-bottom), 18px)",
      }}
    >
      {/* Brighter “glow” background */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-24 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-blue-500/12 blur-[70px]" />
        <div className="absolute top-[240px] left-[-140px] h-[420px] w-[420px] rounded-full bg-blue-500/10 blur-[70px]" />
        <div className="absolute bottom-[-180px] right-[-180px] h-[520px] w-[520px] rounded-full bg-blue-500/10 blur-[80px]" />
      </div>

      <div className="relative mx-auto flex min-h-[100svh] max-w-md flex-col px-4">
        <header className="pt-2">
          <div className="flex items-center justify-between">
            <TopPill>
              <span className="h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_16px_rgba(59,130,246,0.95)]" />
              Global
            </TopPill>

            {user ? (
              <IconBtn icon="🔔" badge={0} ariaLabel="Notifications" onClick={() => {}} />
            ) : (
              <div className="h-10 w-10" />
            )}
          </div>

          <div className="mt-5 flex justify-center">
            <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white/6 shadow-[0_14px_40px_rgba(0,0,0,0.45)] backdrop-blur-[10px]">
              <Image
                src="/quick-logo.png"
                alt="Quick"
                width={48}
                height={48}
                priority
                className="h-[48px] w-[48px]"
              />
            </div>
          </div>

          {user ? (
            <div className="mt-4">
              <GlassCard>
                <div className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[20px] font-extrabold tracking-tight text-white/95 leading-tight">
                        {myOk?.nickname ?? "…"}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <MiniChip icon="🌍" text={`#${myOk?.world_rank ?? "—"}`} />
                        <MiniChip icon="⚡" text={`${myOk?.total_points ?? 0} pts`} />
                      </div>
                    </div>

                    <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/5 shadow-[0_14px_40px_rgba(0,0,0,0.45)]">
                      <span className="text-[18px]">👤</span>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </div>
          ) : null}
        </header>

        <section className="mt-5 space-y-3">
          {screen === "welcome" ? (
            <>
              <Link
                href="/auth?mode=login"
                className={cx(
                  "relative flex w-full items-center justify-between gap-4 rounded-3xl border px-5 py-5 overflow-hidden",
                  "shadow-[0_20px_60px_rgba(0,0,0,0.42)] backdrop-blur-[10px] transition",
                  "active:scale-[0.98] active:opacity-95 hover:bg-white/10",
                  "border-blue-300/16 bg-gradient-to-b from-blue-500/18 to-white/5"
                )}
              >
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.10] via-transparent to-transparent" />
                <div className="relative z-[2] flex items-center gap-4">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/6 shadow-[0_14px_38px_rgba(0,0,0,0.35)]">
                    <span className="text-[18px]">🔐</span>
                  </div>
                  <div className="text-[18px] font-extrabold tracking-tight text-white/95">
                    Login
                  </div>
                </div>
                <div className="relative z-[2] text-white/35 text-[18px]">›</div>
              </Link>

              <Link
                href="/auth?mode=register"
                className={cx(
                  "relative flex w-full items-center justify-between gap-4 rounded-3xl border px-5 py-5 overflow-hidden",
                  "shadow-[0_20px_60px_rgba(0,0,0,0.42)] backdrop-blur-[10px] transition",
                  "active:scale-[0.98] active:opacity-95 hover:bg-white/10",
                  "border-white/10 bg-white/6"
                )}
              >
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.10] via-transparent to-transparent" />
                <div className="relative z-[2] flex items-center gap-4">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/6 shadow-[0_14px_38px_rgba(0,0,0,0.35)]">
                    <span className="text-[18px]">✨</span>
                  </div>
                  <div className="text-[18px] font-extrabold tracking-tight text-white/95">
                    Register
                  </div>
                </div>
                <div className="relative z-[2] text-white/35 text-[18px]">›</div>
              </Link>

              {msg ? (
                <div className="rounded-3xl border border-rose-400/25 bg-rose-500/10 p-4 text-[12px] text-white/85">
                  {msg}
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <ModeTile title="Word Quick" icon="⌨️" href="/quick-word" tone="blue" />
                {user ? (
                  <ModeTile title="Photo Quick" icon="📸" onClick={() => router.push("/quick-photo")} tone="dark" />
                ) : (
                  <ModeTile title="Photo Quick" icon="📸" onClick={openPhoto} tone="dark" />
                )}
              </div>

              {/* NO locked badge; only muted look */}
              <div className="grid grid-cols-2 gap-3">
                <CompactTile title="Create Own" icon="👥" onClick={() => {}} disabledLook />
                <CompactTile title="Tournaments" icon="🏟️" onClick={() => {}} disabledLook />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <IconOnlyLink href="/leaderboard" icon="🏆" ariaLabel="Leaderboard" />
                  <IconOnlyLink href="/settings" icon="⚙️" ariaLabel="Settings" />
                </div>

                <button
                  onClick={logout}
                  className={cx(
                    "rounded-2xl border border-blue-300/14 bg-gradient-to-b from-blue-500/14 to-white/5 px-4 py-3",
                    "shadow-[0_16px_48px_rgba(0,0,0,0.42)] backdrop-blur-[10px]",
                    "text-[14px] font-extrabold text-white/92 transition",
                    "hover:bg-white/10 active:scale-[0.98]"
                  )}
                >
                  ⟲ Logout
                </button>
              </div>

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

        <footer className="mt-auto pb-2 pt-7 text-center text-[11px] text-white/35">
          Quick © {new Date().getFullYear()}
        </footer>
      </div>
    </main>
  );
}
