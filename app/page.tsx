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

/* ---------- UI atoms ---------- */

function IconBox({ icon }: { icon: string }) {
  return (
    <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/12 bg-white/6 text-[18px]">
      {icon}
    </div>
  );
}

function MenuCard({
  title,
  icon,
  href,
  onClick,
  locked,
  primary,
}: {
  title: string;
  icon: string;
  href?: string;
  onClick?: () => void;
  locked?: boolean;
  primary?: boolean;
}) {
  const base =
    "relative w-full rounded-3xl border px-4 py-4 transition active:scale-[0.98]";

  const style = primary
    ? "border-blue-300/25 bg-blue-500/15 hover:shadow-[0_0_40px_rgba(59,130,246,0.25)]"
    : "border-white/12 bg-white/6 hover:bg-white/10";

  const content = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <IconBox icon={icon} />
        <div className="text-[15px] font-semibold text-white">{title}</div>
      </div>
      <div className="text-white/40">→</div>

      {locked && (
        <div className="absolute right-3 top-3 rounded-full border border-rose-300/20 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-100">
          🔒
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className={cx(base, style)}>
        {content}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={cx(base, style)}>
      {content}
    </button>
  );
}

/* ---------- PAGE ---------- */

export default function HomePage() {
  const router = useRouter();

  const [screen, setScreen] = useState<Screen>("welcome");
  const [user, setUser] = useState<null | { id: string; email?: string | null }>(
    null
  );
  const [myStatus, setMyStatus] = useState<MyStatus | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  /* auth */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u ? { id: u.id, email: u.email } : null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user ?? null;
      setUser(u ? { id: u.id, email: u.email } : null);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user) setScreen("menu");
  }, [user]);

  /* my status */
  useEffect(() => {
    if (!user) return;

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

  const headerName = useMemo(() => {
    if (!user) return "Guest";
    if (myStatus?.ok && myStatus.nickname) return myStatus.nickname;
    return user.email?.split("@")[0] ?? "Player";
  }, [user, myStatus]);

  const logout = async () => {
    await supabase.auth.signOut();
    router.refresh();
    setScreen("welcome");
    setMyStatus(null);
  };

  const openPhoto = () => {
    if (!user) {
      setMsg("Photo Quick je dostupan samo za ulogirane korisnike.");
      return;
    }
    router.push("/quick-photo");
  };

  return (
    <main className="min-h-[100svh] bg-gradient-to-b from-slate-950 via-slate-950 to-blue-950 text-white">
      <div className="mx-auto flex min-h-[100svh] max-w-md flex-col px-4 py-4">
        {/* HEADER */}
        <header className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] text-white/50">Player</div>
              <div className="text-[18px] font-extrabold">{headerName}</div>

              {myStatus?.ok && (
                <div className="mt-1 flex gap-2 text-[11px] text-white/70">
                  <span>🌍 #{myStatus.world_rank ?? "—"}</span>
                  <span>⚡ {myStatus.total_points} pts</span>
                </div>
              )}
            </div>

            <Image
              src="/quick-logo.png"
              alt="Quick"
              width={44}
              height={44}
              className="opacity-90"
            />
          </div>
        </header>

        {/* CONTENT */}
        <section className="mt-5 space-y-3">
          {screen === "welcome" ? (
            <>
              <MenuCard title="Login" icon="🔐" href="/auth?mode=login" primary />
              <MenuCard
                title="Register"
                icon="✨"
                href="/auth?mode=register"
              />
            </>
          ) : (
            <>
              {/* QUICK MODES */}
              <div className="grid grid-cols-2 gap-3">
                <MenuCard
                  title="Word Quick"
                  icon="⌨️"
                  href="/quick-word"
                  primary
                />
                <MenuCard
                  title="Photo Quick"
                  icon="📸"
                  onClick={openPhoto}
                  locked={!user}
                />
              </div>

              {/* SOCIAL / EXTRA */}
              <div className="grid grid-cols-2 gap-3">
                <MenuCard
                  title="Create Own"
                  icon="👥"
                  locked
                />
                <MenuCard
                  title="Tournaments"
                  icon="🏟️"
                  locked
                />
              </div>

              {/* META */}
              <div className="grid grid-cols-2 gap-3">
                <MenuCard
                  title="Leaderboard"
                  icon="🏆"
                  href="/leaderboard"
                />
                <MenuCard
                  title="Settings"
                  icon="⚙️"
                  href="/settings"
                />
              </div>

              <button
                onClick={logout}
                className="mt-3 w-full rounded-2xl border border-white/12 bg-white/6 py-3 text-[13px] text-white/80 hover:bg-white/10"
              >
                Logout
              </button>

              {msg && (
                <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 p-3 text-[12px]">
                  {msg}
                </div>
              )}
            </>
          )}
        </section>

        <footer className="mt-auto pt-6 text-center text-[11px] text-white/35">
          Quick © {new Date().getFullYear()}
        </footer>
      </div>
    </main>
  );
}
