"use client";

import Link from "next/link";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function TopBar({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between">
      <Link
        href="/"
        className="rounded-xl border border-white/12 bg-white/6 px-3 py-2 text-[13px] text-white/80 transition hover:bg-white/10 active:scale-[0.98] touch-manipulation"
      >
        ← Back
      </Link>
      <div className="text-[13px] font-semibold text-white/85">{title}</div>
      <div className="w-[64px]" />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <main
      className={cx(
        "min-h-[100svh] w-full",
        "bg-gradient-to-b from-slate-950 via-slate-950 to-blue-950 text-white"
      )}
      style={{
        paddingTop: "max(env(safe-area-inset-top), 18px)",
        paddingBottom: "max(env(safe-area-inset-bottom), 18px)",
      }}
    >
      <div className="mx-auto flex min-h-[100svh] max-w-md flex-col px-4">
        <header className="pt-2">
          <TopBar title="Settings" />
          <h1 className="mt-5 text-2xl font-bold tracking-tight">Settings</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-white/70">
            Later: notifications for new rounds, language, accessibility, etc.
          </p>
        </header>

        <Link
          href="/profile"
          className="block rounded-2xl border border-white/12 bg-white/6 px-5 py-4 transition hover:bg-white/10 active:scale-[0.98] touch-manipulation"
          >     
          <div className="flex items-center justify-between">
              <div>
              <div className="text-[16px] font-semibold text-white/90">Profile</div>
           <div className="mt-1 text-[12px] text-white/65">Nickname, bio, avatar</div>
          </div>
          <div className="text-white/55">→</div>
         </div>
        </Link>


        <section className="mt-6 space-y-3">
          <div className="rounded-2xl border border-white/12 bg-white/6 p-4">
            <div className="text-[12px] text-white/70">Notifications</div>
            <div className="mt-1 text-[13px] text-white/65">
              New round alerts (every 30 min) — coming next.
            </div>
          </div>

          <div className="rounded-2xl border border-white/12 bg-white/6 p-4">
            <div className="text-[12px] text-white/70">Account</div>
            <div className="mt-1 text-[13px] text-white/65">
              Login / Register / Logout — coming next.
            </div>
          </div>

          <div className="rounded-2xl border border-blue-300/20 bg-blue-500/10 p-4">
            <div className="text-[12px] text-white/70">Theme</div>
            <div className="mt-1 text-[13px] text-white/65">
              Blue theme is default. We can add Light/Dark later.
            </div>
          </div>
        </section>

        <footer className="mt-auto pb-2 pt-8 text-center text-[11px] text-white/40">
          Quick • Settings
        </footer>
      </div>
    </main>
  );
}
