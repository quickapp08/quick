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

export default function LeaderboardPage() {
  const [mode, setMode] = useState<Mode>("word");
  const [scope, setScope] = useState<Scope>("world");

  const [region, setRegion] = useState<string>("HR"); // default HR (možeš kasnije automatski iz profila)
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
          <h1 className="mt-5 text-2xl font-bold tracking-tight">Leaderboard</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-white/70">
            {title}
          </p>

          {/* Controls */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode("word")}
              className={cx(
                "rounded-2xl border px-4 py-3 text-left transition active:scale-[0.98]",
                mode === "word"
                  ? "border-blue-300/25 bg-blue-500/15"
                  : "border-white/12 bg-white/6 hover:bg-white/10"
              )}
            >
              <div className="text-[14px] font-semibold">Word Quick</div>
              <div className="mt-1 text-[11px] text-white/60">Speed typing rounds</div>
            </button>

            <button
              onClick={() => setMode("photo")}
              className={cx(
                "rounded-2xl border px-4 py-3 text-left transition active:scale-[0.98]",
                mode === "photo"
                  ? "border-blue-300/25 bg-blue-500/15"
                  : "border-white/12 bg-white/6 hover:bg-white/10"
              )}
            >
              <div className="text-[14px] font-semibold">Photo Quick</div>
              <div className="mt-1 text-[11px] text-white/60">Community-voted photos</div>
            </button>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              onClick={() => setScope("world")}
              className={cx(
                "rounded-2xl border px-4 py-3 text-left transition active:scale-[0.98]",
                scope === "world"
                  ? "border-emerald-300/25 bg-emerald-500/10"
                  : "border-white/12 bg-white/6 hover:bg-white/10"
              )}
            >
              <div className="text-[14px] font-semibold">World</div>
              <div className="mt-1 text-[11px] text-white/60">Global top 100</div>
            </button>

            <button
              onClick={() => setScope("region")}
              className={cx(
                "rounded-2xl border px-4 py-3 text-left transition active:scale-[0.98]",
                scope === "region"
                  ? "border-emerald-300/25 bg-emerald-500/10"
                  : "border-white/12 bg-white/6 hover:bg-white/10"
              )}
            >
              <div className="text-[14px] font-semibold">Region</div>
              <div className="mt-1 text-[11px] text-white/60">Country-based</div>
            </button>
          </div>

          {scope === "region" ? (
            <div className="mt-2 rounded-2xl border border-white/12 bg-white/6 p-3">
              <div className="text-[12px] text-white/70">Region (country code)</div>
              <input
                value={region}
                onChange={(e) => setRegion(e.target.value.toUpperCase())}
                placeholder="HR"
                className="mt-2 w-full rounded-xl border border-white/12 bg-slate-950/40 px-4 py-3 text-[15px] outline-none"
              />
              <div className="mt-2 text-[11px] text-white/45">
                Use ISO code like HR, DE, US. Later we’ll auto-read from profile.
              </div>
            </div>
          ) : null}

          <button
            onClick={fetchBoard}
            className="mt-3 w-full rounded-2xl border border-blue-300/25 bg-gradient-to-b from-blue-500/25 to-blue-500/10 px-5 py-4 text-left transition hover:-translate-y-[1px] hover:shadow-[0_0_40px_rgba(59,130,246,0.28)] active:scale-[0.98]"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[15px] font-semibold">Refresh</div>
                <div className="mt-1 text-[12px] text-white/65">Load top 100</div>
              </div>
              <div className="text-white/55">→</div>
            </div>
          </button>
        </header>

        {/* List */}
        <section className="mt-5 space-y-2">
          {loading ? (
            <div className="rounded-2xl border border-white/12 bg-white/6 p-4 text-white/70">
              Loading...
            </div>
          ) : msg ? (
            <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 p-4 text-white/80">
              {msg}
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-2xl border border-white/12 bg-white/6 p-4 text-white/70">
              No data yet.
            </div>
          ) : (
            rows.map((r) => (
              <div
                key={r.user_id}
                className="rounded-2xl border border-white/12 bg-white/6 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/12 bg-white/5 text-[13px] font-bold">
                      {r.place}
                    </div>
                    <div>
                      <div className="text-[14px] font-semibold">
                        {r.username}{" "}
                        <span className="text-[11px] text-white/45">
                          • {r.country_code}
                        </span>
                      </div>
                      <div className="text-[12px] text-white/60">
                        Rank: {getRank(r.points_total)}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[12px] text-white/60">Points</div>
                    <div className="text-[16px] font-bold">{r.points_total}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </section>

        <footer className="mt-auto pb-2 pt-8 text-center text-[11px] text-white/40">
          Quick • Leaderboard
        </footer>
      </div>
    </main>
  );
}
