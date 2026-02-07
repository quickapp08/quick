"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Period = "weekly" | "monthly";

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

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string; icon: string }>;
}) {
  return (
    <div className="rounded-3xl border border-white/12 bg-white/6 p-1">
      <div className="grid grid-cols-2 gap-1">
        {options.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              onClick={() => onChange(o.value)}
              className={cx(
                "relative overflow-hidden rounded-3xl px-3 py-3 text-left transition active:scale-[0.98] touch-manipulation",
                active
                  ? "border border-blue-300/25 bg-gradient-to-b from-blue-500/22 to-blue-500/10 shadow-[0_0_30px_rgba(59,130,246,0.18)]"
                  : "border border-transparent hover:bg-white/8"
              )}
            >
              {active ? (
                <>
                  <div
                    className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-blue-500/14 blur-2xl"
                    aria-hidden="true"
                  />
                  <div
                    className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-white/6"
                    aria-hidden="true"
                  />
                </>
              ) : null}

              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-2xl border border-white/12 bg-white/5 text-[16px]">
                  {o.icon}
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-white/95">{o.label}</div>
                  <div className={cx("text-[11px]", active ? "text-white/65" : "text-white/45")}>
                    {active ? "Selected" : "Tap to switch"}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function InfoCard({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-3xl border border-white/12 bg-white/6 p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/12 bg-white/5 text-[16px]">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-white/90">{title}</div>
          <div className="mt-1 text-[12px] text-white/65">{text}</div>
        </div>
      </div>
    </div>
  );
}

function PrizeRow({
  place,
  points,
  highlight,
}: {
  place: string;
  points: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={cx(
        "flex items-center justify-between rounded-2xl border px-3 py-2",
        highlight
          ? "border-blue-300/20 bg-blue-500/10"
          : "border-white/10 bg-white/5"
      )}
    >
      <div className="text-[12px] font-semibold text-white/85">{place}</div>
      <div className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/6 px-2.5 py-1">
        <span className="text-[12px]">⚡</span>
        <span className="text-[13px] font-extrabold">{points}</span>
      </div>
    </div>
  );
}

function BigButton({
  icon,
  title,
  subtitle,
  onClick,
  disabled,
  danger,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "group relative overflow-hidden w-full rounded-3xl border px-5 py-4 text-left transition touch-manipulation",
        "active:scale-[0.98]",
        danger
          ? "border-rose-300/25 bg-rose-500/10 hover:border-rose-300/40"
          : "border-blue-300/25 bg-gradient-to-b from-blue-500/22 to-blue-500/10 hover:border-blue-300/45 hover:shadow-[0_0_45px_rgba(59,130,246,0.28)]",
        disabled && "opacity-70 pointer-events-none"
      )}
    >
      {!danger ? (
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
        </>
      ) : null}
      <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-white/6" aria-hidden="true" />

      <div className="relative z-[2] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cx(
              "grid h-10 w-10 place-items-center rounded-2xl border text-[16px]",
              danger
                ? "border-rose-300/25 bg-rose-500/12"
                : "border-blue-300/25 bg-blue-500/12"
            )}
          >
            {icon}
          </div>
          <div>
            <div className="text-[15px] font-semibold">{title}</div>
            <div className="mt-1 text-[11px] text-white/65">{subtitle}</div>
          </div>
        </div>
        <div className="text-white/55">→</div>
      </div>
    </button>
  );
}

export default function TournamentsPage() {
  const [period, setPeriod] = useState<Period>("weekly");
  const [userId, setUserId] = useState<string | null>(null);

  // MVP: local join state (later: store in DB per user)
  const [joinedWeekly, setJoinedWeekly] = useState<boolean>(false);
  const [joinedMonthly, setJoinedMonthly] = useState<boolean>(false);

  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);

      // restore local flags
      try {
        const jw = localStorage.getItem("qt_joined_weekly") === "1";
        const jm = localStorage.getItem("qt_joined_monthly") === "1";
        setJoinedWeekly(jw);
        setJoinedMonthly(jm);
      } catch {}
    })();
  }, []);

  const joined = period === "weekly" ? joinedWeekly : joinedMonthly;

  const prizes = useMemo(() => {
    const mult = period === "monthly" ? 2 : 1;
    return {
      first: 1000 * mult,
      second: 500 * mult,
      third: 250 * mult,
      fourToTen: 100 * mult,
      elevenToTwenty: 50 * mult,
    };
  }, [period]);

  const periodLabel = period === "weekly" ? "Weekly Tournament" : "Monthly Tournament";
  const periodHint =
    period === "weekly"
      ? "Runs every week. Fast, intense, big points."
      : "Runs every month. Longer grind, double rewards.";

  const joinNow = () => {
    setMsg(null);

    if (!userId) {
      setMsg("You must be logged in to join tournaments.");
      return;
    }

    if (period === "weekly") {
      setJoinedWeekly(true);
      try {
        localStorage.setItem("qt_joined_weekly", "1");
      } catch {}
    } else {
      setJoinedMonthly(true);
      try {
        localStorage.setItem("qt_joined_monthly", "1");
      } catch {}
    }

    // MVP: UI only — later: store + enable push/email notifications
    setMsg("Joined. You’ll be notified when the tournament starts.");
  };

  const leave = () => {
    setMsg(null);

    if (period === "weekly") {
      setJoinedWeekly(false);
      try {
        localStorage.setItem("qt_joined_weekly", "0");
      } catch {}
    } else {
      setJoinedMonthly(false);
      try {
        localStorage.setItem("qt_joined_monthly", "0");
      } catch {}
    }

    setMsg("Left the tournament.");
  };

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
          <TopBar title="Tournaments" />

          {/* Header card */}
          <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[12px] font-semibold text-white/85">Tournaments</div>
                <div className="mt-1 text-[12px] text-white/65">
                  Compete globally. Rewards are huge points.
                </div>
              </div>

              <div className="shrink-0 rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[11px] text-white/75">
                🏆 Rewards
              </div>
            </div>
          </div>

          {/* Period switch */}
          <div className="mt-4 space-y-2">
            <Segmented
              value={period}
              onChange={(v) => {
                setMsg(null);
                setPeriod(v as Period);
              }}
              options={[
                { value: "weekly", label: "Weekly", icon: "🗓️" },
                { value: "monthly", label: "Monthly", icon: "📅" },
              ]}
            />
          </div>
        </header>

        <section className="mt-5 space-y-2">
          <InfoCard icon="🎯" title={periodLabel} text={periodHint} />

          <InfoCard
            icon="🔔"
            title="Start notification"
            text="When the tournament starts, you will be notified inside the app."
          />

          <div className="rounded-3xl border border-white/12 bg-white/6 p-4">
            <div className="flex items-center justify-between">
              <div className="text-[12px] font-semibold text-white/85">Prize pool</div>
              <div className="text-[11px] text-white/55">
                {period === "weekly" ? "Weekly" : "Monthly (×2)"}
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <PrizeRow place="1st place" points={prizes.first} highlight />
              <PrizeRow place="2nd place" points={prizes.second} />
              <PrizeRow place="3rd place" points={prizes.third} />
              <PrizeRow place="4th – 10th" points={prizes.fourToTen} />
              <PrizeRow place="11th – 20th" points={prizes.elevenToTwenty} />
            </div>

            <div className="mt-3 text-[11px] text-white/55">
              Rewards are paid as points. Monthly rewards are double.
            </div>
          </div>

          {/* Status */}
          <div className="rounded-3xl border border-white/12 bg-white/6 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[12px] font-semibold text-white/85">Your status</div>
              <div
                className={cx(
                  "rounded-full border px-3 py-1 text-[11px]",
                  joined
                    ? "border-blue-300/20 bg-blue-500/10 text-white/85"
                    : "border-white/12 bg-white/6 text-white/70"
                )}
              >
                {joined ? "Joined" : "Not joined"}
              </div>
            </div>

            <div className="mt-2 text-[12px] text-white/65">
              {joined
                ? "You’re in. You’ll receive a notification when it begins."
                : "Join now to secure your spot."}
            </div>
          </div>

          {msg ? (
            <div className="rounded-3xl border border-white/12 bg-white/6 p-4 text-[12px] text-white/80">
              {msg}
            </div>
          ) : null}

          {/* Actions */}
          {!joined ? (
            <BigButton
              icon="✅"
              title="Join tournament"
              subtitle="You will be notified when it starts"
              onClick={joinNow}
            />
          ) : (
            <BigButton
              icon="✕"
              title="Leave tournament"
              subtitle="You can join again anytime"
              onClick={leave}
              danger
            />
          )}

          {/* MVP hint */}
          <div className="rounded-3xl border border-white/12 bg-white/6 p-4">
            <div className="text-[12px] font-semibold text-white/85">How it works</div>
            <ul className="mt-2 space-y-2 text-[12px] text-white/65">
              <li className="flex gap-2">
                <span className="text-white/60">•</span>
                <span>You play normally (Quick-Word / Quick-Photo).</span>
              </li>
              <li className="flex gap-2">
                <span className="text-white/60">•</span>
                <span>Your points count toward the tournament leaderboard during the active window.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-white/60">•</span>
                <span>Top places win large point rewards.</span>
              </li>
            </ul>
          </div>
        </section>

        <footer className="mt-auto pb-2 pt-8 text-center text-[11px] text-white/40">
          Quick • Tournaments
        </footer>
      </div>
    </main>
  );
}
