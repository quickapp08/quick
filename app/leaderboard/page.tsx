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

type RowWP = RowBase & { points_total: number };
type RowHidden = RowBase & { best_score: number; best_words_count: number };
type RowFast = RowBase & { best_score: number; duration_sec: number };

type Row = RowWP | RowHidden | RowFast;

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

function MedalMini({ place }: { place: number }) {
  if (place === 1) return <span aria-hidden="true">🥇</span>;
  if (place === 2) return <span aria-hidden="true">🥈</span>;
  if (place === 3) return <span aria-hidden="true">🥉</span>;
  return null;
}

function AvatarBadge({
  place,
  url,
  fallbackLetter,
}: {
  place: number;
  url?: string | null;
  fallbackLetter: string;
}) {
  const isTop = place <= 3;
  return (
    <div className="relative h-10 w-10 shrink-0">
      <div
        className={cx(
          "h-10 w-10 overflow-hidden rounded-2xl border bg-white/5",
          isTop ? "border-blue-300/22 bg-blue-500/10" : "border-white/12"
        )}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt="Avatar"
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-[13px] font-extrabold text-white/75">
            {fallbackLetter}
          </div>
        )}
      </div>

      {/* Medal overlay (top 3 only) */}
      {isTop ? (
        <div className="absolute -right-1 -bottom-1 grid h-5 w-5 place-items-center rounded-full border border-white/12 bg-slate-950/55 text-[11px]">
          <MedalMini place={place} />
        </div>
      ) : (
        <div className="absolute -right-1 -bottom-1 grid h-5 min-w-[20px] place-items-center rounded-full border border-white/12 bg-slate-950/55 px-1 text-[10px] font-extrabold text-white/75">
          {place}
        </div>
      )}
    </div>
  );
}

function ModeTabs({
  value,
  onChange,
}: {
  value: Mode;
  onChange: (v: Mode) => void;
}) {
  const items: Array<{ value: Mode; label: string }> = [
    { value: "word", label: "Word" },
    { value: "photo", label: "Photo" },
    { value: "hidden", label: "Hidden" },
    { value: "fast", label: "Fast" },
  ];

  return (
    <div className="rounded-[28px] border border-white/10 bg-white/5 p-2">
      <div className="grid grid-cols-4 gap-2">
        {items.map((it) => {
          const active = it.value === value;
          return (
            <button
              key={it.value}
              onClick={() => onChange(it.value)}
              className={cx(
                "rounded-[22px] border px-3 py-3 text-center text-[12px] font-semibold transition active:scale-[0.98] touch-manipulation",
                active
                  ? "border-blue-300/25 bg-gradient-to-b from-blue-500/22 to-blue-500/10 shadow-[0_0_30px_rgba(59,130,246,0.18)] text-white"
                  : "border-white/10 bg-white/5 text-white/70 hover:bg-white/8"
              )}
            >
              {it.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ScopeTabs({
  value,
  onChange,
  disabled,
}: {
  value: Scope;
  onChange: (v: Scope) => void;
  disabled?: boolean;
}) {
  return (
    <div className={cx("rounded-[28px] border border-white/10 bg-white/5 p-2", disabled && "opacity-60")}>
      <div className="grid grid-cols-2 gap-2">
        {(["world", "region"] as Scope[]).map((s) => {
          const active = s === value;
          return (
            <button
              key={s}
              onClick={() => !disabled && onChange(s)}
              disabled={!!disabled}
              className={cx(
                "rounded-[22px] border px-4 py-3 text-center text-[12px] font-semibold transition active:scale-[0.98] touch-manipulation",
                active
                  ? "border-blue-300/25 bg-blue-500/12 text-white"
                  : "border-white/10 bg-white/5 text-white/70 hover:bg-white/8"
              )}
            >
              {s === "world" ? "World" : "Region"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SegSmall({
  value,
  onChange,
  left,
  right,
}: {
  value: string;
  onChange: (v: string) => void;
  left: { value: string; label: string };
  right: { value: string; label: string };
}) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/5 p-2">
      <div className="grid grid-cols-2 gap-2">
        {[left, right].map((it) => {
          const active = it.value === value;
          return (
            <button
              key={it.value}
              onClick={() => onChange(it.value)}
              className={cx(
                "rounded-[22px] border px-4 py-3 text-center text-[12px] font-semibold transition active:scale-[0.98] touch-manipulation",
                active
                  ? "border-blue-300/25 bg-blue-500/12 text-white"
                  : "border-white/10 bg-white/5 text-white/70 hover:bg-white/8"
              )}
            >
              {it.label}
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

  const [fastDur, setFastDur] = useState<"30" | "60">("60");

  const [limit, setLimit] = useState<number>(5);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [myRank, setMyRank] = useState<{ place: number; scoreLabel: string; subLabel?: string } | null>(null);

  // ✅ new: avatar map by user_id (no RPC changes)
  const [avatarMap, setAvatarMap] = useState<Record<string, string | null>>({});

  const isHidden = mode === "hidden";
  const isFast = mode === "fast";

  useEffect(() => {
    if ((isHidden || isFast) && scope !== "world") setScope("world");
  }, [isHidden, isFast, scope]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!alive) return;
      setUserId(data?.user?.id ?? null);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => {
      setUserId(sess?.user?.id ?? null);
    });
    return () => {
      alive = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  const title = useMemo(() => {
    const m =
      mode === "word" ? "Word Quick" :
      mode === "photo" ? "Photo Quick" :
      mode === "hidden" ? "Hidden Word" :
      "Fast Round";

    const s = (isHidden || isFast) ? "World" : (scope === "world" ? "World" : `Region (${region || "—"})`);
    const extra = isFast ? ` • ${fastDur}s` : "";
    return `${m} • ${s}${extra}`;
  }, [mode, scope, region, isHidden, isFast, fastDur]);

  const fetchBoard = async () => {
    setLoading(true);
    setMsg(null);

    try {
      if (isHidden) {
        const { data, error } = await supabase.rpc("get_hidden_leaderboard", { p_limit: limit });
        if (error) throw error;

        const mapped: RowHidden[] = (data ?? []).map((r: any) => ({
          place: Number(r.place),
          user_id: String(r.user_id),
          username: String(r.username ?? "Player"),
          best_score: Number(r.best_score ?? 0),
          best_words_count: Number(r.best_words_count ?? 0),
        }));
        setRows(mapped);
      } else if (isFast) {
        const { data, error } = await supabase.rpc("get_fast_leaderboard", {
          p_duration_sec: Number(fastDur),
          p_limit: limit,
        });
        if (error) throw error;

        const mapped: RowFast[] = (data ?? []).map((r: any) => ({
          place: Number(r.place),
          user_id: String(r.user_id),
          username: String(r.username ?? "Player"),
          country_code: r.country_code ? String(r.country_code) : undefined,
          best_score: Number(r.best_score ?? 0),
          duration_sec: Number(r.duration_sec ?? Number(fastDur)),
        }));
        setRows(mapped);
      } else {
        const { data, error } = await supabase.rpc("get_leaderboard", {
          p_mode: mode,
          p_scope: scope,
          p_region: scope === "region" ? region : null,
          p_limit: limit,
        });
        if (error) throw error;

        setRows((data ?? []) as RowWP[]);
      }

      if (userId) {
        if (isHidden) {
          const { data, error } = await supabase.rpc("get_my_rank_hidden");
          if (error) throw error;
          const r = (data ?? [])[0];
          if (r) {
            setMyRank({
              place: Number(r.place),
              scoreLabel: `${Number(r.best_score ?? 0)} score`,
              subLabel: `${Number(r.best_words_count ?? 0)} words`,
            });
          } else setMyRank(null);
        } else if (isFast) {
          const { data, error } = await supabase.rpc("get_my_rank_fast", { p_duration_sec: Number(fastDur) });
          if (error) throw error;
          const r = (data ?? [])[0];
          if (r) {
            setMyRank({
              place: Number(r.place),
              scoreLabel: `${Number(r.best_score ?? 0)} score`,
              subLabel: `${Number(r.duration_sec ?? Number(fastDur))}s`,
            });
          } else setMyRank(null);
        } else {
          const { data, error } = await supabase.rpc("get_my_rank_word_photo", {
            p_mode: mode,
            p_scope: scope,
            p_region: scope === "region" ? region : null,
          });
          if (error) throw error;
          const r = (data ?? [])[0];
          if (r) {
            const pts = Number(r.points_total ?? 0);
            setMyRank({
              place: Number(r.place),
              scoreLabel: `${pts} pts`,
              subLabel: `Rank: ${getRank(pts)}`,
            });
          } else setMyRank(null);
        }
      } else {
        setMyRank(null);
      }

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
  }, [mode, scope, region, fastDur, limit, userId]);

  // ✅ new: fetch avatars for current rows (safe + minimal)
  useEffect(() => {
    let alive = true;

    async function loadAvatars() {
      const ids = Array.from(new Set(rows.map((r) => r.user_id))).filter(Boolean);
      if (ids.length === 0) {
        setAvatarMap({});
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, avatar_url")
        .in("user_id", ids);

      if (!alive) return;
      if (error) {
        // don't break leaderboard if avatars fail
        return;
      }

      const map: Record<string, string | null> = {};
      for (const p of data ?? []) {
        map[String((p as any).user_id)] = ((p as any).avatar_url ?? null) as string | null;
      }
      setAvatarMap(map);
    }

    loadAvatars();
    return () => {
      alive = false;
    };
  }, [rows]);

  const canLoadMore = limit < 100;

  const loadMore = () => {
    setLimit((prev) => {
      if (prev < 10) return 10;
      if (prev < 25) return 25;
      if (prev < 50) return 50;
      return 100;
    });
  };

  const resetLimit = () => setLimit(5);

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
                Top {limit}
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/25 p-3">
              {!userId ? (
                <div className="text-[12px] text-white/70">
                  Sign in to see <b>your rank</b>.
                </div>
              ) : myRank ? (
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-white/55">Your rank</div>
                    <div className="mt-1 text-[14px] font-semibold text-white/90">
                      #{myRank.place} • {myRank.scoreLabel}
                    </div>
                    {myRank.subLabel ? (
                      <div className="mt-0.5 text-[11px] text-white/55">{myRank.subLabel}</div>
                    ) : null}
                  </div>
                  <div className="rounded-full border border-blue-300/20 bg-blue-500/12 px-3 py-1 text-[11px] text-white/80">
                    You
                  </div>
                </div>
              ) : (
                <div className="text-[12px] text-white/70">
                  Your rank is not available yet.
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <ModeTabs
              value={mode}
              onChange={(v) => {
                setMode(v);
                setMsg(null);
                resetLimit();
              }}
            />

            <ScopeTabs
              value={scope}
              onChange={(v) => {
                setScope(v);
                setMsg(null);
                resetLimit();
              }}
              disabled={isHidden || isFast}
            />

            {isFast ? (
              <SegSmall
                value={fastDur}
                onChange={(v) => {
                  setFastDur(v as "30" | "60");
                  setMsg(null);
                  resetLimit();
                }}
                left={{ value: "30", label: "30s" }}
                right={{ value: "60", label: "60s" }}
              />
            ) : null}

            {scope === "region" && !isHidden && !isFast ? (
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

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={fetchBoard}
                className={cx(
                  "rounded-[28px] border border-blue-300/25 bg-gradient-to-b from-blue-500/22 to-blue-500/10 px-5 py-4 text-left transition",
                  "hover:-translate-y-[1px] hover:shadow-[0_0_45px_rgba(59,130,246,0.28)] active:scale-[0.98] touch-manipulation"
                )}
              >
                <div className="text-[13px] font-semibold">Refresh</div>
                <div className="mt-1 text-[11px] text-white/65">Reload list</div>
              </button>

              <button
                onClick={() => resetLimit()}
                className={cx(
                  "rounded-[28px] border border-white/10 bg-white/5 px-5 py-4 text-left transition",
                  "hover:bg-white/8 active:scale-[0.98] touch-manipulation"
                )}
              >
                <div className="text-[13px] font-semibold">Top 5</div>
                <div className="mt-1 text-[11px] text-white/65">Reset view</div>
              </button>
            </div>
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
              <div className="text-[13px] font-semibold text-white/85">No data yet</div>
              <div className="mt-1 text-[11px] text-white/55">Try refresh in a moment.</div>
            </div>
          ) : (
            <>
              {rows.map((r) => {
                const isTop = r.place <= 3;
                const isHiddenRow = "best_words_count" in r;
                const isFastRow = "duration_sec" in r;

                const rightLabel =
                  isHiddenRow
                    ? { title: "Score", val: (r as RowHidden).best_score, icon: "🧩" }
                    : isFastRow
                    ? { title: "Best", val: (r as RowFast).best_score, icon: "⚡" }
                    : { title: "Points", val: (r as RowWP).points_total, icon: "⚡" };

                const avatarUrl = avatarMap[r.user_id] ?? null;
                const fallbackLetter = (r.username?.trim()?.[0] ?? "P").toUpperCase();

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
                        {/* ✅ avatar left */}
                        <AvatarBadge
                          place={r.place}
                          url={avatarUrl}
                          fallbackLetter={fallbackLetter}
                        />

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
                                🔤 {(r as RowHidden).best_words_count} words
                              </span>
                            </div>
                          ) : (
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-white/12 bg-white/6 px-2 py-1 text-[11px] text-white/75">
                                ⏱ {(r as RowFast).duration_sec}s
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-[11px] text-white/55">{rightLabel.title}</div>
                        <div className="mt-1 inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/6 px-3 py-2">
                          <span className="text-[14px]">{rightLabel.icon}</span>
                          <span className="text-[16px] font-extrabold">{rightLabel.val}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="pt-2">
                <button
                  onClick={loadMore}
                  disabled={!canLoadMore}
                  className={cx(
                    "w-full rounded-[28px] border px-5 py-4 text-left transition active:scale-[0.98] touch-manipulation",
                    canLoadMore
                      ? "border-blue-300/25 bg-gradient-to-b from-blue-500/22 to-blue-500/10 hover:-translate-y-[1px] hover:shadow-[0_0_45px_rgba(59,130,246,0.22)]"
                      : "border-white/10 bg-white/5 opacity-60"
                  )}
                >
                  <div className="text-[13px] font-semibold">
                    {canLoadMore ? "Load more" : "All loaded"}
                  </div>
                  <div className="mt-1 text-[11px] text-white/65">
                    {canLoadMore ? "Show more ranks (up to Top 100)" : "You reached Top 100 view"}
                  </div>
                </button>
              </div>
            </>
          )}
        </section>

        <footer className="mt-auto pb-2 pt-8 text-center text-[11px] text-white/40">
          Quick • Leaderboard
        </footer>
      </div>
    </main>
  );
}
