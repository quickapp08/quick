"use client";

import Link from "next/link";
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

/** Modal shell (reusable popout) */
function Popout({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[999] flex items-end justify-center px-4 pb-4 pt-10"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
      />

      {/* Sheet */}
      <div
        className={cx(
          "relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70",
          "shadow-[0_30px_90px_rgba(0,0,0,0.65)] backdrop-blur-[14px]"
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="text-[14px] font-extrabold tracking-tight text-white/90">
            {title}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={cx(
              "grid h-9 w-9 place-items-center rounded-2xl border border-white/10 bg-white/5",
              "hover:bg-white/8 active:scale-[0.98]"
            )}
            aria-label="Close"
          >
            <span className="text-[16px] leading-none">✕</span>
          </button>
        </div>

        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/** Big tile (Word/Photo/Hidden/Fast) */
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

  // ✅ CHANGE: icon has NO surrounding box now
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
          <span className="text-[20px] leading-none" aria-hidden="true">
            {icon}
          </span>
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

  if (href)
    return (
      <Link href={href} className={cx(base, toneCls)}>
        {inner}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} className={cx(base, toneCls)}>
      {inner}
    </button>
  );
}

/** Compact tile (Together/Tournaments) */
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
        disabledLook
          ? "border-white/8 bg-white/4 opacity-80"
          : "border-white/10 bg-white/6"
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.10] via-transparent to-transparent"
        aria-hidden="true"
      />
      <div className="relative z-[2] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* ✅ CHANGE: icon has NO surrounding box now */}
          <span className="text-[20px] leading-none" aria-hidden="true">
            {icon}
          </span>
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

function IconOnlyButton({
  icon,
  ariaLabel,
  onClick,
}: {
  icon: string;
  ariaLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cx(
        "grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/6",
        "shadow-[0_16px_48px_rgba(0,0,0,0.42)] backdrop-blur-[10px] transition",
        "hover:bg-white/10 active:scale-[0.98]"
      )}
    >
      <span className="text-[18px] leading-none">{icon}</span>
    </button>
  );
}

/* -------------------- Page (logic unchanged) -------------------- */

export default function HomePage() {
  const router = useRouter();

  const [screen, setScreen] = useState<Screen>("welcome");
  const [user, setUser] = useState<null | { id: string; email?: string | null }>(
    null
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [myStatus, setMyStatus] = useState<MyStatus | null>(null);

  // ✅ NEW (minimal): avatar_url from profiles
  const [myAvatarUrl, setMyAvatarUrl] = useState<string>("");

  // ✅ NEW: popouts
  const [notifOpen, setNotifOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

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
      setMyAvatarUrl("");
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

  // ✅ NEW (minimal): load avatar_url (same cadence as status, no logic changes)
  useEffect(() => {
    let alive = true;

    async function loadMyAvatar() {
      if (!user) {
        setMyAvatarUrl("");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!alive) return;
      if (error) return;

      const url = String((data as any)?.avatar_url ?? "").trim();
      setMyAvatarUrl(url);
    }

    loadMyAvatar();
    const t = setInterval(loadMyAvatar, 15000);

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
    setMyAvatarUrl("");
    setNotifOpen(false);
    setHelpOpen(false);
  };

  const openPhoto = () => {
    if (!user) {
      setMsg("Photo Quick is only playable when you are logged in / registered.");
      return;
    }
    router.push("/quick-photo");
  };

  const myOk = myStatus && myStatus.ok === true ? myStatus : null;

  const goPickAvatar = () => {
    router.push("/profile");
  };

  const hasAvatar = !!myAvatarUrl;

  return (
    <main
      className="relative min-h-[100svh] w-full text-white bg-gradient-to-b from-slate-950 via-slate-950 to-blue-950 overflow-x-hidden overscroll-x-none touch-pan-y"
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

      {/* Popouts */}
      {notifOpen ? (
        <Popout title="Notifications" onClose={() => setNotifOpen(false)}>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
            <div className="text-[13px] font-semibold text-white/90">
              No notifications
            </div>
            <div className="mt-1 text-[12px] text-white/60">
              Trenutno nema nikakvih notifikacija.
            </div>
          </div>
        </Popout>
      ) : null}

      {helpOpen ? (
        <Popout title="Help" onClose={() => setHelpOpen(false)}>
          <div className="space-y-2">
            {[
              {
                t: "Word Quick",
                d: "Guess the word as fast as possible. Points are added to your total and the leaderboard.",
                i: "⌨️",
              },
              {
                t: "Photo Quick",
                d: "Same as Word Quick, but with photos. Get ready.",
                i: "📸",
              },
              {
                t: "Hidden Word",
                d: "Special mode: words + score are counted as “best.”",
                i: "🕵️",
              },
              {
                t: "Fast Round",
                d: "Fast mode: you play against the clock, and the best score is recorded.",
                i: "⚡",
              },
              {
                t: "Together",
                d: "You play in private rooms with your crew (rank and chat in the room).",
                i: "👥",
              },
              {
                t: "Tournaments",
                d: "Weekly / Monthly tournaments. When they start — you’ll get a notification (coming soon).",
                i: "🏟️",
              },
            ].map((x) => (
              <div
                key={x.t}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-2xl border border-white/10 bg-white/5">
                    <span className="text-[16px] leading-none" aria-hidden="true">
                      {x.i}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-white/90">
                      {x.t}
                    </div>
                    <div className="mt-0.5 text-[12px] text-white/60">
                      {x.d}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Popout>
      ) : null}

      <div className="relative mx-auto flex min-h-[100svh] max-w-md flex-col px-4 overflow-x-hidden overflow-y-auto">
        <header className="pt-2">
          <div className="flex items-center justify-between">
            <TopPill>
              <span className="h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_16px_rgba(59,130,246,0.95)]" />
              Global
            </TopPill>

            {user ? (
              <IconBtn
                icon="🔔"
                badge={0}
                ariaLabel="Notifications"
                onClick={() => setNotifOpen(true)}
              />
            ) : (
              <div className="h-10 w-10" />
            )}
          </div>

          {/* ✅ quick text (NOT in a button / NOT in a box) */}
          <div className="mt-5 flex justify-center">
            <span className="text-[30px] font-extrabold tracking-tight text-white/95">
              quick
            </span>
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

                    {/* Avatar on Home (click to change) */}
                    <button
                      type="button"
                      onClick={goPickAvatar}
                      aria-label="Change avatar"
                      className={cx(
                        "relative grid h-12 w-12 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white/5",
                        "shadow-[0_14px_40px_rgba(0,0,0,0.45)] transition active:scale-[0.98]",
                        "hover:bg-white/10"
                      )}
                    >
                      {hasAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={myAvatarUrl}
                          alt="Avatar"
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <span className="text-[18px]">👤</span>
                      )}

                      {!hasAvatar ? (
                        <span
                          className={cx(
                            "absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full",
                            "border border-emerald-300/30 bg-emerald-500/30 text-emerald-100",
                            "shadow-[0_0_16px_rgba(16,185,129,0.35)]"
                          )}
                          aria-hidden="true"
                        >
                          +
                        </span>
                      ) : null}
                    </button>
                  </div>
                </div>
              </GlassCard>
            </div>
          ) : null}
        </header>

        <section className="mt-5 space-y-3">
          {screen === "welcome" ? (
            <>
              {/* ✅ Login/Register untouched (only visual already exists, logic unchanged) */}
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
                  <ModeTile
                    title="Photo Quick"
                    icon="📸"
                    onClick={() => router.push("/quick-photo")}
                    tone="dark"
                  />
                ) : (
                  <ModeTile title="Photo Quick" icon="📸" onClick={openPhoto} tone="dark" />
                )}

                <ModeTile title="Hidden Word" icon="🕵️" href="/hidden-word" tone="blue" />
                <ModeTile title="Fast Round" icon="⚡" href="/fast-round" tone="blue" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <CompactTile title="Together" icon="👥" onClick={() => router.push("/create-own")} />
                <CompactTile title="Tournaments" icon="🏟️" onClick={() => router.push("/tournaments")} />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <IconOnlyLink href="/leaderboard" icon="🏆" ariaLabel="Leaderboard" />
                  <IconOnlyLink href="/settings" icon="⚙️" ariaLabel="Settings" />
                  {/* ✅ NEW: Help icon + popout */}
                  <IconOnlyButton icon="❔" ariaLabel="Help" onClick={() => setHelpOpen(true)} />
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
