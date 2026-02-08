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

function Icon({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "blue" | "slate" | "emerald";
}) {
  const cls =
    tone === "emerald"
      ? "border-emerald-300/20 bg-emerald-500/12 text-emerald-100"
      : tone === "blue"
      ? "border-blue-300/20 bg-blue-500/12 text-blue-100"
      : "border-white/12 bg-white/6 text-white/80";

  return (
    <div
      className={cx("grid h-10 w-10 place-items-center rounded-2xl border", cls)}
      aria-hidden="true"
    >
      <span className="text-[16px] leading-none">{children}</span>
    </div>
  );
}

function RowLink({
  href,
  title,
  subtitle,
  icon,
  tone,
}: {
  href?: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  tone?: "blue" | "slate" | "emerald";
}) {
  const content = (
    <div className="flex items-center gap-3">
      <Icon tone={tone}>{icon}</Icon>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold text-white/90">{title}</div>
        <div className="mt-0.5 text-[12px] text-white/60">{subtitle}</div>
      </div>
      <div className="text-white/45">→</div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-2xl border border-white/12 bg-white/6 px-4 py-3 transition hover:bg-white/10 active:scale-[0.98] touch-manipulation"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="rounded-2xl border border-white/12 bg-white/6 px-4 py-3">
      {content}
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

          <div className="mt-4">
            <h1 className="text-[22px] font-bold tracking-tight">Settings</h1>
            <p className="mt-1 text-[12px] leading-relaxed text-white/60">
              Manage your profile and preferences. More options coming soon.
            </p>
          </div>
        </header>

        <section className="mt-4">
          <Link
            href="/profile"
            className={cx(
              "block rounded-3xl border border-blue-300/20",
              "bg-gradient-to-b from-blue-500/18 to-white/5",
              "px-5 py-4 transition hover:-translate-y-[1px] hover:shadow-[0_0_40px_rgba(59,130,246,0.25)] active:scale-[0.98] touch-manipulation"
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Icon tone="blue">👤</Icon>
                <div>
                  <div className="text-[15px] font-semibold text-white/95">Profile</div>
                  <div className="mt-0.5 text-[12px] text-white/65">
                    Nickname, bio, avatar
                  </div>
                </div>
              </div>
              <div className="rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[11px] font-semibold text-white/80">
                Edit →
              </div>
            </div>
          </Link>
        </section>

        <section className="mt-4 space-y-2">
          <div className="px-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-white/45">
              Preferences
            </div>
          </div>

          <RowLink
            title="Notifications"
            subtitle="New round alerts — coming next"
            icon="🔔"
            tone="slate"
          />

          <RowLink
            href="/auth?mode=login"
            title="Account"
            subtitle="Login / Register / Logout"
            icon="🔒"
            tone="slate"
          />

          <RowLink
            title="Theme"
            subtitle="Blue theme is default. Light/Dark later"
            icon="🎨"
            tone="blue"
          />
        </section>

        <section className="mt-3">
          <div className="rounded-2xl border border-white/10 bg-white/4 px-4 py-3">
            <div className="text-[12px] font-semibold text-white/80">Tip</div>
            <div className="mt-0.5 text-[12px] text-white/55">
              We’ll keep Settings minimal so it stays fast and clean on mobile.
            </div>
          </div>
        </section>

        <footer className="mt-auto pb-2 pt-6 text-center text-[11px] text-white/35">
          Quick • Settings
        </footer>
      </div>
    </main>
  );
}
