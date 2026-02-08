"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { getRank } from "../../lib/rank";

type Mode = "word" | "photo" | "hidden";
type Scope = "world" | "region";

type RowBase = {
  place: number;
  user_id: string;
  username: string;
  country_code?: string;
};

type RowWP = RowBase & {
  points_total: number;
};

type RowHidden = RowBase & {
  best_score: number;
  best_words_count: number;
};

type Row = RowWP | RowHidden;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function TopBar({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between">
      <Link
        href="/"
        className="rounded-2xl border border-white/12 bg-white/6 px-3 py-2 text-[13px] text-white/85 transition hover:bg-white/10 active:scale-[0.98] touch-manipulation"
      >
        ← Back
      </Link>
      <div className="text-[13px] font-semibold text-white/85">{title}</div>
      <div className="w-[64px]" />
    </div>
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

function ModePicker({
  value,
  onChange,
}: {
  value: Mode;
  onChange: (v: Mode) => void;
}) {
  const items: Array<{
    value: Mode;
    title: string;
    sub: string;
    icon: string;
  }> = [
    { value: "word", title: "Word", sub: "Scrambled word", icon: "⌨️" },
    { value: "photo", title: "Photo", sub: "Real-life prompt", icon: "📸" },
    { value: "hidden", title: "Hidden", sub: "Tap letters", icon: "🧩" },
  ];

  return (
    <div className="rounded-[28px] border border-white/10 bg-white/5 p-2">
      <div className="grid grid-cols-3 gap-2">
        {items.map((it) => {
          const active = it.value === value;
          return (
            <button
              key={it.value}
              onClick={() => onChange(it.value)}
              className={cx(
                "relative overflow-hidden rounded-[22px] border px-3 py-3 text-left transition active:scale-[0.98] touch-manipulation",
                active
                  ? "border-blue-300/25 bg-gradient-to-b from-blue-500/22 to-blue-500/10 shadow-[0_0_30px_rgba(59,130,246,0.18)]"
                  : "border-white/10 bg-white/5 hover:bg-white/8"
              )}
            >
              {active ? (
                <>
                  <div
                    className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-blue-500/14 blur-2xl"
                    aria-hidden="true"
                  />
                  <div
                    className="pointer-events-none absolute inset-0 rounded-[22px] ring-1 ring-white/6"
                    aria-hidden="true"
                  />
                </>
              ) : null}

              <div className="flex items-start gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-2xl border border-white/12 bg-white/5 text-[16px]">
                  {it.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-white/95">
                    {it.title}
                  </div>
                  <div className={cx("mt-0.5 text-[10px] leading-snug", active ? "text-white/65" : "text-white/45")}>
                    {it.sub}
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

function ScopePicker({
  value,
  onChange,
  disabled,
}: {
  value: Scope;
  onChange: (v: Scope) => void;
  disabled?: boolean;
}) {
  const items: Array<{ value: Scope; label: string; icon: string }> = [
    { value: "world", label: "World", icon: "🌍" },
    { value: "region", label: "Region", icon: "🗺️" },
  ];

  return (
    <div className={cx("rounded-[28px] border border-white/10 bg-white/5 p-2", disabled && "opacity-60")}>
      <div className="grid grid-cols-2 gap-2">
        {items.map((it) => {
          const active = it.value === value;
          return (
            <button
              key={it.value}
              onClick={() => !disabled && onChange(it.value)}
              disabled={!!disabled}
              className={cx(
                "rounded-[22px] border px-4 py-3 text-left transition active:scale-[0.98] touch-manipulation",
                active
                  ? "border-blue-300/25 bg-blue-500/12"
                  : "border-white/10 bg-white/5 hover:bg-white/8"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-2xl border border-white/12 bg-white/5 text-[16px]">
                    {it.icon}
                  </span>
                  <div className="text-[13px] font-semibold text-white/90">
                    {it.label}
                  </div>
                </div>
                <div className={cx("text-[11px]", active ? "text-white/65" : "text-white/35")}>
                  {active ? "Selected" : ""}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const [mode, setMode] = useState<Mode>("word");
  const [scope, setScope] = useState<Scope>("world");
  const [region, setRegion] = useState<string>("HR");

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  // Hidden: only world
  useEffect(() => {
    if (mode === "hidden" && scope !== "world") setScope("world");
  }, [mode, scope]);

  const title = useMemo(() => {
    const m = mode === "word" ? "Word Quick" : mode === "photo" ? "Photo Quick" : "Hidden Word";
    const s = mode === "hidden" ? "World" : scope === "world" ? "World" : `Region (${region || "—"})`;
    return `${m} • ${s}`;
  }, [mode, scope, region]);

  const fetchBoard = async () => {
    setLoading(true);
    setMsg(null);

    try {
      if (mode === "hidden") {
        const { data, error } = await supabase
          .from("v_hidden_word_leaderboard_top100")
          .select("user_id, username, best_score, best_words_count")
          .limit(100);

        if (error) throw error;

        const mapped: RowHidden[] = (data ?? []).map((r: any, idx: number) => ({
          place: idx + 1,
          user_id: String(r.user_id),
          username: String(r.username ?? "Player"),
          best_score: Number(r.best_score ?? 0),
          best_words_count: Number(r.best_words_count ?? 0),
        }));

        setRows(mapped);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.rpc("get_leaderboard", {
        p_mode: mode,
        p_scope: scope,
        p_region: scope === "region" ? region : null,
        p_limit: 100,
      });

      if (error) throw error;

      setRows((data ?? []) as RowWP[]);
      setLoading(false);
    } catch (e: any) {
      setRows([]);
      setLoading(false);
      setMsg(e?.message ?? "Failed to load leaderboard.");
    }
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

          <div className="mt-4 rounded-[28px] border border-white/10 bg-white/5 p-4">
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

          <div className="mt-4 space-y-2">
            {/* Better mode selector */}
            <ModePicker value={mode} onChange={setMode} />

            {/* Scope selector */}
            <ScopePicker value={scope} onChange={setScope} disabled={mode === "hidden"} />

            {/* Region input */}
            {scope === "region" && mode !== "hidden" ? (
              <div className="rounded-[28px] border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[12px] font-semibold text-white/85">Region code</div>
                  <div className="text-[11px] text-white/45">ISO (HR, DE, US…)</div>
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

            <button
              onClick={fetchBoard}
              className={cx(
                "group relative overflow-hidden w-full rounded-[28px] border border-blue-300/25",
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
                className="pointer-events-none absolute inset-0 rounded-[28px] ring-1 ring-white/6"
                aria-hidden="true"
              />
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
          </div>
        </header>

        <section className="mt-5 space-y-2">
          {loading ? (
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 text-white/70">
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
            <div className="rounded-[28px] border border-rose-400/25 bg-rose-500/10 p-4 text-white/85">
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
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 text-white/70">
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
              const isHiddenRow = "best_score" in r;

              return (
                <div
                  key={`${r.user_id}-${r.place}`}
                  className={cx(
                    "rounded-[28px] border p-4",
                    isTop ? "border-blue-300/20 bg-blue-500/10" : "border-white/10 bg-white/5"
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

                          {"country_code" in r && r.country_code ? (
                            <span className="shrink-0 rounded-full border border-white/12 bg-white/6 px-2 py-0.5 text-[10px] text-white/70">
                              {r.country_code}
                            </span>
                          ) : null}
                        </div>

                        {!isHiddenRow ? (
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-white/12 bg-white/6 px-2 py-1 text-[11px] text-white/75">
                              🏷️ {getRank((r as RowWP).points_total)}
                            </span>
                          </div>
                        ) : (
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-white/12 bg-white/6 px-2 py-1 text-[11px] text-white/75">
                              🧩 Hidden Word
                            </span>
                            <span className="rounded-full border border-white/12 bg-white/6 px-2 py-1 text-[11px] text-white/75">
                              🔤 {(r as RowHidden).best_words_count} words
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-[11px] text-white/55">
                        {isHiddenRow ? "Score" : "Points"}
                      </div>

                      <div className="mt-1 inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/6 px-3 py-2">
                        <span className="text-[14px]">{isHiddenRow ? "🧩" : "⚡"}</span>
                        <span className="text-[16px] font-extrabold">
                          {isHiddenRow ? (r as RowHidden).best_score : (r as RowWP).points_total}
                        </span>
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
