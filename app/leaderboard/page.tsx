"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { getRank } from "../../lib/rank";

type Mode = "word" | "photo" | "hidden" | "fast";
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

type RowFast = RowBase & {
  best_score: number;
  duration_sec: number; // 30 or 60
};

type Row = RowWP | RowHidden | RowFast;

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
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
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

  const [fastDuration, setFastDuration] = useState<"30" | "60">("60");

  const [region, setRegion] = useState<string>("HR");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [msg, setMsg] = useState<string | null>(null);

  // Hidden + Fast = world only (za sad)
  useEffect(() => {
    if ((mode === "hidden" || mode === "fast") && scope !== "world") setScope("world");
  }, [mode, scope]);

  const title = useMemo(() => {
    const m =
      mode === "word"
        ? "Word Quick"
        : mode === "photo"
        ? "Photo Quick"
        : mode === "hidden"
        ? "Hidden Word"
        : "Fast Round";

    const s =
      mode === "hidden" || mode === "fast"
        ? "World"
        : scope === "world"
        ? "World"
        : `Region (${region || "—"})`;

    const extra = mode === "fast" ? ` • ${fastDuration}s` : "";
    return `${m} • ${s}${extra} • Top 100`;
  }, [mode, scope, region, fastDuration]);

  const fetchBoard = async () => {
    setLoading(true);
    setMsg(null);

    // Hidden Word (view)
    if (mode === "hidden") {
      const { data, error } = await supabase
        .from("v_hidden_word_leaderboard_top100")
        .select("user_id, username, best_score, best_words_count")
        .limit(100);

      if (error) {
        setMsg(error.message);
        setRows([]);
        setLoading(false);
        return;
      }

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

    // Fast Round (view)
    if (mode === "fast") {
      const dur = Number(fastDuration);

      const { data, error } = await supabase
        .from("v_fast_round_leaderboard")
        .select("user_id, username, country_code, duration_sec, best_score")
        .eq("duration_sec", dur)
        .order("best_score", { ascending: false })
        .order("last_played_at", { ascending: false })
        .limit(100);

      if (error) {
        setMsg(error.message);
        setRows([]);
        setLoading(false);
        return;
      }

      const mapped: RowFast[] = (data ?? []).map((r: any, idx: number) => ({
        place: idx + 1,
        user_id: String(r.user_id),
        username: String(r.username ?? "Player"),
        country_code: r.country_code ? String(r.country_code) : undefined,
        duration_sec: Number(r.duration_sec ?? dur),
        best_score: Number(r.best_score ?? 0),
      }));

      setRows(mapped);
      setLoading(false);
      return;
    }

    // Word/Photo (RPC ostaje netaknuto)
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

    setRows((data ?? []) as RowWP[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchBoard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, scope, region, fastDuration]);

  const isHidden = mode === "hidden";
  const isFast = mode === "fast";

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

          <div className="mt-4 space-y-2">
            <Segmented
              value={mode}
              onChange={(v) => setMode(v as Mode)}
              options={[
                { value: "word", label: "Word", icon: "⌨️" },
                { value: "photo", label: "Photo", icon: "📸" },
                { value: "hidden", label: "Hidden", icon: "🧩" },
                { value: "fast", label: "Fast", icon: "⚡" },
              ]}
            />

            {/* Scope (Fast/Hidden će automatski ostati World) */}
            <Segmented
              value={scope}
              onChange={(v) => setScope(v as Scope)}
              options={[
                { value: "world", label: "World", icon: "🌍" },
                { value: "region", label: "Region", icon: "🗺️" },
              ]}
            />

            {/* Fast duration toggle */}
            {isFast ? (
              <Segmented
                value={fastDuration}
                onChange={(v) => setFastDuration(v as "30" | "60")}
                options={[
                  { value: "30", label: "30s", icon: "⏱️" },
                  { value: "60", label: "60s", icon: "⏱️" },
                ]}
              />
            ) : null}

            {/* Region input only for Word/Photo */}
            {scope === "region" && !isHidden && !isFast ? (
              <div className="rounded-3xl border border-white/12 bg-white/6 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[12px] font-semibold text-white/85">Region code</div>
                  <div className="text-[11px] text-white/45">ISO (e.g. HR, DE, US)</div>
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

            {(isHidden || isFast) && scope === "region" ? (
              <div className="rounded-3xl border border-white/12 bg-white/6 p-4 text-[12px] text-white/70">
                This mode currently supports <b>World</b> leaderboard only.
              </div>
            ) : null}

            <button
              onClick={fetchBoard}
              className={cx(
                "group relative overflow-hidden mt-1 w-full rounded-3xl border border-blue-300/25",
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
          </div>
        </header>

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
              const isHiddenRow = "best_words_count" in r;
              const isFastRow = "duration_sec" in r;

              return (
                <div
                  key={`${r.user_id}:${r.place}`}
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

                          {"country_code" in r && r.country_code ? (
                            <span className="shrink-0 rounded-full border border-white/12 bg-white/6 px-2 py-0.5 text-[10px] text-white/70">
                              {r.country_code}
                            </span>
                          ) : null}
                        </div>

                        {!isHiddenRow && !isFastRow ? (
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-white/12 bg-white/6 px-2 py-1 text-[11px] text-white/75">
                              🏷️ {getRank((r as RowWP).points_total)}
                            </span>
                          </div>
                        ) : isHiddenRow ? (
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-white/12 bg-white/6 px-2 py-1 text-[11px] text-white/75">
                              🧩 Hidden Word
                            </span>
                            <span className="rounded-full border border-white/12 bg-white/6 px-2 py-1 text-[11px] text-white/75">
                              🔤 {(r as RowHidden).best_words_count} words
                            </span>
                          </div>
                        ) : (
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-white/12 bg-white/6 px-2 py-1 text-[11px] text-white/75">
                              ⚡ Fast Round
                            </span>
                            <span className="rounded-full border border-white/12 bg-white/6 px-2 py-1 text-[11px] text-white/75">
                              ⏱ {(r as RowFast).duration_sec}s
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-[11px] text-white/55">
                        {isHiddenRow || isFastRow ? "Best" : "Points"}
                      </div>

                      <div className="mt-1 inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/6 px-3 py-2">
                        <span className="text-[14px]">
                          {isHiddenRow ? "🧩" : isFastRow ? "⚡" : "⚡"}
                        </span>
                        <span className="text-[16px] font-extrabold">
                          {isHiddenRow
                            ? (r as RowHidden).best_score
                            : isFastRow
                            ? (r as RowFast).best_score
                            : (r as RowWP).points_total}
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
