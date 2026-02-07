"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type IntervalMin = 60 | 30;
const ALL_INTERVALS: IntervalMin[] = [60, 30];

// Offset to prevent overlap:
// 60m -> 0 offset (e.g. 12:00, 13:00)
// 30m -> +5 minutes offset (e.g. 12:05, 12:35, 13:05, 13:35)
const OFFSETS_MS: Record<IntervalMin, number> = {
  60: 0,
  30: 5 * 60 * 1000,
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

function msToClock(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Interval helpers with offset support (prevents 30/60 overlap)
function floorToIntervalStartMs(nowMs: number, intervalMin: number, offsetMs: number) {
  const intervalMs = intervalMin * 60 * 1000;
  const shifted = nowMs - offsetMs;
  return Math.floor(shifted / intervalMs) * intervalMs + offsetMs;
}

function nextDropMs(nowMs: number, intervalMin: number, offsetMs: number) {
  const intervalMs = intervalMin * 60 * 1000;
  const shifted = nowMs - offsetMs;
  return Math.ceil(shifted / intervalMs) * intervalMs + offsetMs;
}

function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
function writeLS(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

const ANSWER_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

type Settings = {
  participate: boolean;
  enabledIntervals: Record<IntervalMin, boolean>;
};

type ResultState = {
  ok: boolean;
  correct?: boolean;
  ms: number;
  interval: IntervalMin;
  points: number;
  serverError?: string;
  serverAnswer?: string;
};

type SubmitWordResponse =
  | {
      ok: true;
      correct: boolean;
      points: number;
      ms_from_start: number;
      round_start: string;
      server_now: string;
      answer: string;
    }
  | {
      ok: false;
      error: string;
      round_start?: string;
    };

type GetCurrentWordResponse =
  | {
      ok: true;
      interval_min: number;
      round_start: string;
      word: string;
      server_now: string;
    }
  | { ok: false; error: string };

// ---------- stable (seeded) scramble so it NEVER keeps changing ----------
function hashToUint32(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function scrambleWordSeeded(word: string, seedKey: string) {
  const arr = word.split("");
  const rand = mulberry32(hashToUint32(seedKey));
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join("");
}
// -----------------------------------------------------------------------

export default function QuickWordPage() {
  const router = useRouter();

  // ✅ REQUIRE LOGIN
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    const boot = async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data?.user?.id ?? null;

      if (!alive) return;

      if (!uid) {
        router.replace("/login");
        return;
      }

      setUserId(uid);
      setAuthReady(true);
    };

    boot();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      if (!uid) router.replace("/login");
      else setAuthReady(true);
    });

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe();
    };
  }, [router]);

  const [participate, setParticipate] = useState<boolean>(true);
  const [enabledIntervals, setEnabledIntervals] = useState<Record<IntervalMin, boolean>>({
    60: true,
    30: true,
  });

  const [nowClient, setNowClient] = useState<number>(Date.now());
  const [serverNowAtFetch, setServerNowAtFetch] = useState<number>(0);
  const [clientNowAtFetch, setClientNowAtFetch] = useState<number>(0);

  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<ResultState | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [serverWord, setServerWord] = useState<string>(""); // keep (even if not shown)
  const [scrambled, setScrambled] = useState<string>("");

  const notifiedKeySetRef = useRef<Set<string>>(new Set());
  const prevMsLeftRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const saved = readLS<Settings>("quick_word_settings_v3", {
      participate: true,
      enabledIntervals: { 60: true, 30: true },
    });
    setParticipate(saved.participate);
    setEnabledIntervals(saved.enabledIntervals);
  }, []);

  useEffect(() => {
    writeLS("quick_word_settings_v3", { participate, enabledIntervals });
  }, [participate, enabledIntervals]);

  useEffect(() => {
    const id = window.setInterval(() => setNowClient(Date.now()), 200);
    return () => window.clearInterval(id);
  }, []);

  const now = useMemo(() => {
    if (!serverNowAtFetch || !clientNowAtFetch) return nowClient;
    return serverNowAtFetch + (nowClient - clientNowAtFetch);
  }, [nowClient, serverNowAtFetch, clientNowAtFetch]);

  const selectedIntervals = useMemo(() => {
    const picked = ALL_INTERVALS.filter((i) => enabledIntervals[i]);
    return picked.length ? picked : ([30] as IntervalMin[]);
  }, [enabledIntervals]);

  const activeWindow = useMemo(() => {
    let best: null | { interval: IntervalMin; startMs: number; endMs: number } = null;

    for (const i of selectedIntervals) {
      const offset = OFFSETS_MS[i];
      const startMs = floorToIntervalStartMs(now, i, offset);
      const endMs = startMs + ANSWER_WINDOW_MS;
      const inWindow = now >= startMs && now < endMs;
      if (!inWindow) continue;

      if (!best) best = { interval: i, startMs, endMs };
      else if (endMs < best.endMs) best = { interval: i, startMs, endMs };
    }
    return best;
  }, [now, selectedIntervals]);

  const nextDrop = useMemo(() => {
    let best: null | { interval: IntervalMin; dropMs: number } = null;
    for (const i of selectedIntervals) {
      const offset = OFFSETS_MS[i];
      const d = nextDropMs(now, i, offset);
      if (!best || d < best.dropMs) best = { interval: i, dropMs: d };
    }
    return best!;
  }, [now, selectedIntervals]);

  const activeInterval: IntervalMin = useMemo(
    () => (activeWindow ? activeWindow.interval : nextDrop.interval),
    [activeWindow, nextDrop.interval]
  );

  const activeRoundStartMs = useMemo(() => {
    if (activeWindow) return activeWindow.startMs;
    return nextDrop.dropMs;
  }, [activeWindow, nextDrop.dropMs]);

  // ✅ STABLE KEY so effects don't re-run every render
  const activeWindowKey = useMemo(() => {
    if (!activeWindow) return null;
    return `${activeWindow.interval}:${activeWindow.startMs}`;
  }, [activeWindow?.interval, activeWindow?.startMs]);

  const lastKeyRef = useRef<string | null>(null);

  // ✅ ONLY LOAD WORD ONCE PER WINDOW KEY (no more constant re-scramble)
  useEffect(() => {
    if (!authReady || !userId) return;
    if (!activeWindowKey) return;

    if (lastKeyRef.current !== activeWindowKey) {
      lastKeyRef.current = activeWindowKey;
      setAnswer("");
      setResult(null);
      setSubmitting(false);
      setServerWord("");
      setScrambled("");
    }

    const load = async () => {
      const clientNow = Date.now();
      const { data, error } = await supabase.rpc("get_current_word", {
        p_interval_min: activeWindow!.interval,
      });

      if (error) {
        console.error(error);
        return;
      }
      const res = data as GetCurrentWordResponse;
      if (!res || res.ok !== true) {
        console.error(res);
        return;
      }

      const w = String(res.word || "");
      const serverNowMs = new Date(String(res.server_now)).getTime();

      setServerNowAtFetch(serverNowMs);
      setClientNowAtFetch(clientNow);

      setServerWord(w);
      setScrambled(w ? scrambleWordSeeded(w, activeWindowKey) : "");
    };

    load();
    // IMPORTANT: dependencies are stable strings/numbers, not the activeWindow object
  }, [activeWindowKey, authReady, userId]);

  // ✅ FIXED notifications: fire only when crossing <= 1 minute
  useEffect(() => {
    if (!authReady || !userId) return;
    if (!participate) return;
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;

    const oneMin = 60 * 1000;

    for (const i of selectedIntervals) {
      const offset = OFFSETS_MS[i];
      const d = nextDropMs(now, i, offset);
      const msLeft = d - now;

      const key = `${i}:${d}`;
      const prevKey = `prev_${i}`;
      const prev = prevMsLeftRef.current[prevKey];

      const crossed = typeof prev === "number" && prev > oneMin && msLeft <= oneMin && msLeft > 0;

      prevMsLeftRef.current[prevKey] = msLeft;

      if (!crossed) continue;
      if (notifiedKeySetRef.current.has(key)) continue;

      notifiedKeySetRef.current.add(key);

      if (Notification.permission === "granted") {
        try {
          new Notification("Quick — Word incoming", {
            body: "Word incoming in 1 minute",
          });
        } catch (e) {
          console.warn("Notification failed:", e);
        }
      }
    }

    for (const k of Array.from(notifiedKeySetRef.current)) {
      const parts = k.split(":");
      if (parts.length !== 2) continue;
      const d = Number(parts[1]);
      if (!Number.isFinite(d)) continue;
      if (d < now - 10 * 60 * 1000) notifiedKeySetRef.current.delete(k);
    }
  }, [now, participate, selectedIntervals, authReady, userId]);

  const requestNotifications = async () => {
    if (!("Notification" in window)) {
      alert("Notifications not supported in this browser.");
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        alert("Notifications are disabled. Please allow them to get alerts.");
      }
    } catch (e) {
      console.warn(e);
      alert("Notifications permission request failed on this device/browser.");
    }
  };

  const timeLabel = useMemo(() => {
    if (activeWindow) return msToClock(activeWindow.endMs - now);
    return msToClock(nextDrop.dropMs - now);
  }, [activeWindow, nextDrop.dropMs, now]);

  const headerRight = useMemo(() => {
    if (activeWindow) {
      return `Ends: ${new Date(activeWindow.endMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
    return `Starts: ${new Date(nextDrop.dropMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }, [activeWindow, nextDrop.dropMs]);

  const onSend = async () => {
    if (!authReady || !userId) return;
    if (!activeWindow) return;
    if (submitting) return;

    setSubmitting(true);
    setResult(null);

    const intervalMin = activeWindow.interval;
    const userAnswer = answer.trim().toLowerCase();

    const { data, error } = await supabase.rpc("submit_word", {
      p_interval_min: intervalMin,
      p_answer: userAnswer,
    });

    if (error) {
      setResult({
        ok: false,
        ms: 0,
        interval: intervalMin,
        points: 0,
        serverError: error.message,
      });
      setSubmitting(false);
      return;
    }

    const res = data as SubmitWordResponse;

    if (!res || res.ok !== true) {
      setResult({
        ok: false,
        ms: 0,
        interval: intervalMin,
        points: 0,
        serverError: (res as { ok: false; error: string })?.error ?? "unknown_error",
      });
      setSubmitting(false);
      return;
    }

    const serverNowMs = new Date(String(res.server_now)).getTime();
    setServerNowAtFetch(serverNowMs);
    setClientNowAtFetch(Date.now());

    setResult({
      ok: true,
      correct: res.correct,
      ms: Number(res.ms_from_start ?? 0),
      interval: intervalMin,
      points: Number(res.points ?? 0),
      serverAnswer: String(res.answer ?? ""),
    });

    setSubmitting(false);
  };

  const toggleInterval = (i: IntervalMin) => {
    setEnabledIntervals((prev) => ({ ...prev, [i]: !prev[i] }));
  };

  if (!authReady || !userId) {
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
            <TopBar title="Word Quick" />
            <h1 className="mt-5 text-2xl font-bold tracking-tight">Word Quick</h1>
            <p className="mt-2 text-[13px] leading-relaxed text-white/70">Redirecting to login…</p>
          </header>
        </div>
      </main>
    );
  }

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
      {/* Mobile-first: keep content within viewport, avoid scroll.
         We use a compact header + main "game card", settings collapsed. */}
      <div className="mx-auto flex min-h-[100svh] max-w-md flex-col px-4">
        {/* Compact header */}
        <header className="pt-2">
          <TopBar title="Word Quick" />
          <div className="mt-4 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-[22px] font-bold tracking-tight">Word Quick</h1>
              <div className="mt-1 text-[12px] text-white/60">
                {activeWindow ? "Answer window is live" : "Waiting for next drop"} •{" "}
                <span className="text-white/75">{headerRight}</span>
              </div>
            </div>

            {/* tiny status pill */}
            <div
              className={cx(
                "shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold",
                activeWindow ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100" : "border-blue-300/25 bg-blue-500/10 text-blue-100"
              )}
              title={activeWindow ? "You can answer now" : "Word is hidden until start"}
            >
              {activeWindow ? "LIVE" : "SOON"}
            </div>
          </div>
        </header>

        {/* Main gameplay area (fits in one screen) */}
        <section className="mt-4 space-y-3">
          {/* Game card */}
          <div
            className={cx(
              "rounded-2xl border p-4",
              activeWindow ? "border-emerald-400/20 bg-emerald-500/10" : "border-blue-300/20 bg-blue-500/10"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="text-[12px] text-white/70">
                {activeWindow ? `2 min window • ${activeInterval} min` : `Next word • ${nextDrop.interval} min`}
              </div>
              <div className="text-[12px] font-semibold text-white/85">{timeLabel}</div>
            </div>

            <div className="mt-3">
              {activeWindow ? (
                <div className="select-none text-[42px] font-extrabold leading-none tracking-tight">
                  {scrambled || "…"}
                </div>
              ) : (
                <div className="text-[13px] text-white/60">Word is hidden. Get ready.</div>
              )}
            </div>

            {/* small hint line */}
            <div className="mt-3 text-[11px] text-white/55">
              Case doesn’t matter. You have <b>2 minutes</b> to submit.
            </div>
          </div>

          {/* Input + Send (compact) */}
          <div className="rounded-2xl border border-white/12 bg-white/6 p-4">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <label className="block text-[12px] text-white/70">Type the correct word</label>
                <input
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder={activeWindow ? "Type here..." : "Wait for the word..."}
                  disabled={!activeWindow || submitting}
                  className={cx(
                    "mt-2 w-full rounded-xl border px-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-blue-400/60",
                    activeWindow
                      ? "border-white/12 bg-slate-950/40 text-white placeholder:text-white/35"
                      : "border-white/8 bg-slate-950/20 text-white/40 placeholder:text-white/25"
                  )}
                />
              </div>

              <button
                onClick={onSend}
                disabled={!activeWindow || submitting}
                className={cx(
                  "shrink-0 rounded-2xl border px-4 py-3 text-[13px] font-semibold transition active:scale-[0.98] touch-manipulation",
                  activeWindow && !submitting
                    ? "border-blue-300/25 bg-gradient-to-b from-blue-500/25 to-blue-500/10 hover:-translate-y-[1px] hover:shadow-[0_0_40px_rgba(59,130,246,0.28)]"
                    : "border-white/10 bg-white/5 opacity-50"
                )}
                style={{ minWidth: 96 }}
              >
                {submitting ? "Sending…" : "Send"}
              </button>
            </div>

            {/* Result (compact, doesn’t push layout too much) */}
            {result ? (
              <div
                className={cx(
                  "mt-3 rounded-xl border px-3 py-2",
                  result.ok && result.correct
                    ? "border-emerald-400/25 bg-emerald-500/10"
                    : "border-rose-400/25 bg-rose-500/10"
                )}
              >
                {result.serverError ? (
                  <div className="text-[12px] font-semibold">Error ❌ — {result.serverError}</div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 text-[12px] font-semibold">
                      {result.correct ? "Correct ✅" : `Wrong ❌ — ${result.serverAnswer ?? "?"}`}
                      <div className="mt-0.5 text-[11px] font-normal text-white/65">
                        {result.interval} min • {result.ms} ms
                      </div>
                    </div>
                    <div className="shrink-0 rounded-full border border-white/12 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/85">
                      +{result.points}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Settings collapsed (no scroll) */}
          <details className="rounded-2xl border border-white/12 bg-white/6">
            <summary className="cursor-pointer list-none px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13px] font-semibold text-white/85">Game settings</div>
                  <div className="mt-0.5 text-[11px] text-white/55">
                    Participation • Intervals • Notifications
                  </div>
                </div>
                <div className="text-white/55">▾</div>
              </div>
            </summary>

            <div className="px-4 pb-4 pt-1">
              <div className="text-[12px] font-semibold text-white/85">Participation</div>
              <label className="mt-2 flex items-center gap-3 text-[13px] text-white/80">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-blue-400"
                  checked={participate}
                  onChange={(e) => setParticipate(e.target.checked)}
                />
                Participate in timed words
              </label>

              <div className="mt-4 text-[12px] font-semibold text-white/85">Intervals</div>
              <div className="mt-2 grid grid-cols-1 gap-2">
                {ALL_INTERVALS.map((i) => (
                  <label
                    key={i}
                    className="flex items-center justify-between rounded-xl border border-white/12 bg-white/5 px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        className="h-5 w-5 accent-blue-400"
                        checked={!!enabledIntervals[i]}
                        onChange={() => toggleInterval(i)}
                      />
                      <div className="text-[13px] text-white/80">
                        {i} min {i === 30 ? "(+5)" : "(00)"}
                      </div>
                    </div>
                    <div className="text-[11px] text-white/50">
                      next:{" "}
                      {new Date(nextDropMs(now, i, OFFSETS_MS[i])).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </label>
                ))}
              </div>

              <button
                onClick={requestNotifications}
                className="mt-3 w-full rounded-2xl border border-blue-300/25 bg-gradient-to-b from-blue-500/25 to-blue-500/10 px-4 py-3 text-left transition hover:-translate-y-[1px] hover:shadow-[0_0_40px_rgba(59,130,246,0.28)] active:scale-[0.98] touch-manipulation"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-semibold">Enable notifications</div>
                    <div className="mt-0.5 text-[11px] text-white/65">“Word incoming in 1 minute”</div>
                  </div>
                  <div className="text-white/55">→</div>
                </div>
              </button>

              <div className="mt-2 text-[11px] text-white/45">
                Browser fully closed = not reliable until PWA + Service Worker.
              </div>
            </div>
          </details>
        </section>

        <footer className="mt-auto pb-2 pt-6 text-center text-[11px] text-white/35">
          Quick • Word Quick
        </footer>
      </div>
    </main>
  );
}
