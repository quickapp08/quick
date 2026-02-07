"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { getRank } from "../../lib/rank";

type Mode = "word" | "photo";
type Scope = "world" | "region";

type Row = {
  place: number;
  user_id: string;
  username: string;
  country_code: string;
  points_total: number;
};

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

function SectionLabel({ icon, label, right }: { icon: string; label: string; right?: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-2xl border border-white/12 bg-white/6 text-[14px]">
          {icon}
        </span>
        <div className="text-[12px] font-semibold uppercase tracking-wider text-white/55">
          {label}
        </div>
      </div>
      {right ? (
        <div className="rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[11px] text-white/65">
          {right}
        </div>
      ) : null}
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
                "group relative overflow-hidden rounded-3xl px-3 py-3 text-left transition active:scale-[0.98] touch-manipulation",
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
                  <div
                    className={cx(
                      "pointer-events-none absolute -left-36 top-0 h-full w-36 rotate-[20deg]",
                      "bg-gradient-to-r from-transparent via-white/12 to-transparent blur-xl",
                      "transition-transform duration-700 ease-out",
                      "group-hover:translate-x-[520px]"
                    )}
                    aria-hidden="true"
                  />
                </>
              ) : null}

              <div className="flex items-center gap-2">
                <span
                  className={cx(
                    "grid h-9 w-9 place-items-center rounded-2xl border bg-white/5 text-[16px]",
                    active ? "border-blue-300/25" : "border-white/12"
                  )}
                >
                  {o.icon}
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-white/95">{o.label}</div>
                  <div className={cx("text-[11px]", active ? "text-white/65" : "text-white/45")}>
                    {active ? "Selected" : "Tap"}
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

function NavTile({
  title,
  icon,
  href,
  disabled,
  badge,
}: {
  title: string;
  icon: string;
  href?: string;
  disabled?: boolean;
  badge?: string;
}) {
  const base =
    "group relative overflow-hidden rounded-3xl border px-4 py-4 text-left transition touch-manipulation " +
    "active:scale-[0.98] active:opacity-95";

  const cls = disabled
    ? "border-white/10 bg-white/5 opacity-70 cursor-not-allowed"
    : "border-white/12 bg-white/6 hover:border-white/22 hover:bg-white/10 hover:shadow-[0_0_34px_rgba(59,130,246,0.14)]";

  const content = (
    <>
      <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-white/5" aria-hidden="true" />
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-blue-500/10 blur-2xl"
        aria-hidden="true"
      />
      <div className="relative z-[2] flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/12 bg-white/5 text-[16px]">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-white/95">{title}</div>
            {badge ? (
              <div className="mt-1 inline-flex rounded-full border border-white/12 bg-white/6 px-2 py-0.5 text-[10px] text-white/70">
                {badge}
              </div>
            ) : null}
          </div>
        </div>
        <div className="shrink-0 text-white/45">→</div>
      </div>
    </>
  );

  if (disabled || !href) {
    return <div className={cx(base, cls)} aria-disabled>{content}</div>;
  }

  return (
    <Link href={href} className={cx(base, cls)}>
      {content}
    </Link>
  );
}

function Medal({ place }: { place: number }) {
  if (place === 1) return <span aria-hidden="true">🥇</span>;
  if (place === 2) return <span aria-hidden="true">🥈</span>;
  if (place === 3) return <span aria-hidden="true">🥉</span>;
  return <span className="text-white/55" aria-hidden="true">#{place}</span>;
}

function PlaceBadge({ place }: { place: number }) {
  const isTop = place <= 3;
  return (
    <div
      className={cx(
        "grid h-10 w-10 place-items-center rounded-2xl border text-[13px] font-extrabold",
        isTop
          ? "border-blue-300/25 bg-blue-500/12 text-white"
          : "border-white/12 bg-white/5 text-white/80"
      )}
      aria-label={`Place ${place}`}
    >
      <Medal place={place} />
    </div>
  );
}

export default function LeaderboardPage() {
  const [mode, setMode] = useState<Mode>("word");
  const [scope, setScope] = useState<Scope>("world");

  const [region, setRegion] = useState<string>("HR");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [msg, setMsg] = useState<string | null>(null);

  const title = useMemo(() => {
    const m = mode === "word" ? "Word Quick" : "Photo Quick";
    const s = scope === "world" ? "World" : `Region (${region || "—"})`;
    return `${m} • ${s} • Top 100`;
  }, [mode, scope, region]);

  const fetchBoard = async () => {
    setLoading(true);
    setMsg(null);

    const { data, error } = await supabase.rpc("get_leaderboard", {
      p_mode: mode,
      p_scope: scope,
      p_region: scope === "region" ? region : null,
      p_limit: 100,
    });

    if (error) {
      setMsg(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data ?? []) as Row[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchBoard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, scope, region]);

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
          <TopBar title="Leaderboard" />

          {/* Header card */}
          <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[12px] font-semibold text-white/85">Leaderboard</div>
                <div className="mt-1 text-[12px] text-white/65">{title}</div>
              </div>
              <div className="shrink-0 rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[11px] text-white/75">
                🏁 Top 100
              </div>
            </div>
          </div>

          {/* QUICK MODE */}
          <div className="mt-4 space-y-2">
            <SectionLabel icon="⚡" label="Quick Mode" right="Pick one" />
            <Segmented
              value={mode}
              onChange={(v) => setMode(v as Mode)}
              options={[
                { value: "word", label: "Word Quick", icon: "⌨️" },
                { value: "photo", label: "Photo Quick", icon: "📸" },
              ]}
            />
          </div>

          {/* SCOPE */}
          <div className="mt-3 space-y-2">
            <SectionLabel icon="🌍" label="Scope" right={scope === "world" ? "World" : "Region"} />
            <Segmented
              value={scope}
              onChange={(v) => setScope(v as Scope)}
              options={[
                { value: "world", label: "World", icon: "🌍" },
                { value: "region", label: "Region", icon: "🗺️" },
              ]}
            />

            {scope === "region" ? (
              <div className="rounded-3xl border border-white/12 bg-white/6 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[12px] font-semibold text-white/85">Region code</div>
                  <div className="text-[11px] text-white/45">ISO (HR, DE, US)</div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/12 bg-white/5 text-[16px]">
                    🏳️
                  </div>
                  <input
                    value={region}
                    onChange={(e) => setRegion(e.target.value.toUpperCase())}
                    placeholder="HR"
                    className="w-full rounded-2xl border border-white/12 bg-slate-950/40 px-4 py-3 text-[15px] outline-none focus:border-white/25 focus:bg-slate-950/55"
                  />
                </div>
              </div>
            ) : null}
          </div>

          {/* EXTRA (as requested) */}
          <div className="mt-4 space-y-2">
            <SectionLabel icon="🧩" label="More" right="Coming soon + shortcuts" />
            <div className="grid grid-cols-2 gap-3">
              <NavTile title="Create own" icon="👥" disabled badge="Coming soon" />
              <NavTile title="Tournament" icon="🏟️" disabled badge="Coming soon" />
              <NavTile title="Leaderboard" icon="🏆" disabled badge="You are here" />
              <NavTile title="Settings" icon="⚙️" href="/settings" />
            </div>
          </div>

          {/* Refresh */}
          <button
            onClick={fetchBoard}
            className={cx(
              "group relative overflow-hidden mt-4 w-full rounded-3xl border border-blue-300/25",
              "bg-gradient-to-b from-blue-500/22 to-blue-500/10",
              "px-5 py-4 text-left transition touch-manipulation",
              "hover:-translate-y-[1px] hover:border-blue-300/45 hover:shadow-[0_0_45px_rgba(59,130,246,0.28)]",
              "active:scale-[0.98]"
            )}
          >
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

            <div className="relative z-[2] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl border border-blue-300/25 bg-blue-500/12 text-[16px]">
                  🔄
                </div>
                <div>
                  <div className="text-[15px] font-semibold">Refresh</div>
                  <div className="mt-1 text-[11px] text-white/65">Reload current top 100</div>
                </div>
              </div>
              <div className="text-white/55">→</div>
            </div>
          </button>
        </header>

        {/* List */}
        <section className="mt-5 space-y-2">
          {loading ? (
            <div className="rounded-3xl border border-white/12 bg-white/6 p-4 text-white/70">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/12 bg-white/5 text-[16px]">
                  ⏳
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-white/85">Loading</div>
                  <div className="text-[11px] text-white/55">Fetching leaderboard…</div>
                </div>
              </div>
            </div>
          ) : msg ? (
            <div className="rounded-3xl border border-rose-400/25 bg-rose-500/10 p-4 text-white/85">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl border border-rose-300/20 bg-rose-500/10 text-[16px]">
                  ⚠️
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold">Error</div>
                  <div className="mt-1 text-[12px] text-white/80">{msg}</div>
                </div>
              </div>
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-3xl border border-white/12 bg-white/6 p-4 text-white/70">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/12 bg-white/5 text-[16px]">
                  💤
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-white/85">No data yet</div>
                  <div className="text-[11px] text-white/55">Try refresh in a moment.</div>
                </div>
              </div>
            </div>
          ) : (
            rows.map((r) => {
              const isTop = r.place <= 3;

              return (
                <div
                  key={r.user_id}
                  className={cx(
                    "rounded-3xl border p-4",
                    isTop ? "border-blue-300/20 bg-blue-500/10" : "border-white/12 bg-white/6"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <PlaceBadge place={r.place} />

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="truncate text-[14px] font-semibold text-white/95">
                            {r.username}
                          </div>
                          <span className="shrink-0 rounded-full border border-white/12 bg-white/6 px-2 py-0.5 text-[10px] text-white/70">
                            {r.country_code}
                          </span>
                        </div>

                        <div className="mt-1">
                          <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[11px] text-white/75">
                            🏷️ {getRank(r.points_total)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-[11px] text-white/55">Points</div>
                      <div className="mt-1 inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/6 px-3 py-2">
                        <span className="text-[14px]">⚡</span>
                        <span className="text-[16px] font-extrabold">{r.points_total}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>

        <footer className="mt-auto pb-2 pt-8 text-center text-[11px] text-white/40">
          Quick • Leaderboard
        </footer>
      </div>
    </main>
  );
}
