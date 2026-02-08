"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type IntervalMin = 60 | 30;
const ALL_INTERVALS: IntervalMin[] = [60, 30];

// 60m -> 0 offset (12:00, 13:00)
// 30m -> +5min offset (12:05, 12:35, 13:05, 13:35)
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
        className={cx(
          "rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-[13px] font-semibold text-white/80",
          "shadow-[0_14px_40px_rgba(0,0,0,0.42)] backdrop-blur-[10px] transition",
          "hover:bg-white/10 active:scale-[0.98] touch-manipulation"
        )}
      >
        ← Back
      </Link>

      <div className="text-[13px] font-semibold text-white/85">{title}</div>

      <div className="w-[72px]" />
    </div>
  );
}

function msToClock(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Interval helpers with offset support
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
  serverAnswer?: string; // correct answer
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

// ---------- stable scramble ----------
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
  const out = arr.join("");
  return out === word && word.length >= 2 ? word[1] + word[0] + word.slice(2) : out;
}
// -----------------------------------

type AttemptStore = {
  submitted: boolean;
  correct?: boolean;
  points?: number;
  answer?: string; // correct answer from server
  userAnswer?: string;
  ts?: number;
};

function attemptKey(userId: string, interval: IntervalMin, roundStartMs: number) {
  return `qw_attempt_v1:${userId}:${interval}:${roundStartMs}`;
}

/* -------------------- UI atoms (visual only) -------------------- */

function GlassCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-[26px] border border-white/10 bg-white/[0.06]",
        "shadow-[0_22px_70px_rgba(0,0,0,0.46)] backdrop-blur-[12px]",
        className
      )}
    >
      {children}
    </div>
  );
}

function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ready" | "live";
}) {
  const cls =
    tone === "ready"
      ? "border-blue-300/20 bg-blue-500/18 text-blue-100"
      : tone === "live"
      ? "border-emerald-400/20 bg-emerald-500/14 text-emerald-50"
      : "border-white/10 bg-white/5 text-white/80";

  return (
    <span className={cx("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold", cls)}>
      {children}
    </span>
  );
}

function RightCapsule({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid gap-2">
      <div className="ml-auto">
        <Pill tone="ready">⚡ READY</Pill>
      </div>

      <div className="ml-auto w-[110px] rounded-[22px] border border-white/10 bg-white/5 p-3 shadow-[0_18px_55px_rgba(0,0,0,0.35)] backdrop-blur-[10px]">
        <div className="text-[11px] font-semibold text-white/55">{label}</div>
        <div className="mt-1 text-[22px] font-extrabold tracking-tight text-white/95 leading-none">
          {value}
        </div>
      </div>
    </div>
  );
}

function SelectCard({
  title,
  subtitle,
  selected,
  onClick,
  icon,
  rightBadge,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  onClick: () => void;
  icon: string;
  rightBadge: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "w-full rounded-[24px] border px-4 py-4 text-left transition touch-manipulation",
        "shadow-[0_18px_52px_rgba(0,0,0,0.40)] backdrop-blur-[12px]",
        selected
          ? "border-blue-300/22 bg-gradient-to-b from-blue-500/20 to-white/5"
          : "border-white/10 bg-white/5 hover:bg-white/7",
        "active:scale-[0.98]"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/6 shadow-[0_12px_34px_rgba(0,0,0,0.35)]">
            <span className="text-[18px] leading-none">{icon}</span>
          </div>

          <div className="min-w-0">
            <div className="text-[15px] font-extrabold tracking-tight text-white/95">{title}</div>
            <div className={cx("mt-1 text-[12px]", selected ? "text-white/65" : "text-white/55")}>
              {subtitle}
            </div>
          </div>
        </div>

        <span
          className={cx(
            "shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold",
            selected ? "border-blue-300/22 bg-blue-500/16 text-blue-100" : "border-white/10 bg-white/5 text-white/65"
          )}
        >
          {rightBadge}
        </span>
      </div>
    </button>
  );
}

/* -------------------- Page (logic unchanged) -------------------- */

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

  const [serverWord, setServerWord] = useState<string>(""); // keep
  const [scrambled, setScrambled] = useState<string>("");

  // 1-attempt lock per round
  const [attempt, setAttempt] = useState<AttemptStore>({ submitted: false });

  // notifications stuff (keep)
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

  // stable key per round
  const activeRoundKey = useMemo(() => {
    // Use the ROUND START even outside window so we can keep UI stable.
    // When window is not active, this equals next drop time.
    return `${activeInterval}:${activeRoundStartMs}`;
  }, [activeInterval, activeRoundStartMs]);

  // Load attempt state from LS for this round
  useEffect(() => {
    if (!userId) return;
    const k = attemptKey(userId, activeInterval, activeRoundStartMs);
    const stored = readLS<AttemptStore>(k, { submitted: false });
    setAttempt(stored);
  }, [userId, activeInterval, activeRoundStartMs]);

  // Load word once per LIVE window (same as before)
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!authReady || !userId) return;
    if (!activeWindow) return;

    const liveKey = `${activeWindow.interval}:${activeWindow.startMs}`;

    if (lastKeyRef.current !== liveKey) {
      lastKeyRef.current = liveKey;
      setAnswer("");
      setResult(null);
      setSubmitting(false);
      setServerWord("");
      setScrambled("");
      // attempt loaded via other effect (LS)
    }

    const load = async () => {
      const clientNow = Date.now();
      const { data, error } = await supabase.rpc("get_current_word", {
        p_interval_min: activeWindow.interval,
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
      setScrambled(w ? scrambleWordSeeded(w, liveKey) : "");
    };

    load();
  }, [authReady, userId, activeWindow]);

  // notifications (unchanged)
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
          new Notification("Quick — Word incoming", { body: "Word incoming in 1 minute" });
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
      if (perm !== "granted") alert("Notifications are disabled. Please allow them to get alerts.");
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
      return `Ends ${new Date(activeWindow.endMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
    return `Starts ${new Date(nextDrop.dropMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }, [activeWindow, nextDrop.dropMs]);

  const locked = useMemo(() => {
    // Lock if already submitted in this round (even if window still active)
    return !!attempt.submitted;
  }, [attempt.submitted]);

  const canType = useMemo(() => {
    return !!activeWindow && !submitting && !locked;
  }, [activeWindow, submitting, locked]);

  const onSend = async () => {
    if (!authReady || !userId) return;
    if (!activeWindow) return;
    if (submitting) return;
    if (locked) return;

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

    const newResult: ResultState = {
      ok: true,
      correct: res.correct,
      ms: Number(res.ms_from_start ?? 0),
      interval: intervalMin,
      points: Number(res.points ?? 0),
      serverAnswer: String(res.answer ?? ""),
    };
    setResult(newResult);

    // ✅ lock for this round
    const store: AttemptStore = {
      submitted: true,
      correct: !!res.correct,
      points: Number(res.points ?? 0),
      answer: String(res.answer ?? ""),
      userAnswer,
      ts: Date.now(),
    };
    setAttempt(store);
    writeLS(attemptKey(userId, intervalMin as IntervalMin, activeWindow.startMs), store);

    setSubmitting(false);
  };

  const toggleInterval = (i: IntervalMin) => {
    setEnabledIntervals((prev) => ({ ...prev, [i]: !prev[i] }));
  };

  if (!authReady || !userId) {
    return (
      <main
        className={cx("min-h-[100svh] w-full", "bg-gradient-to-b from-slate-950 via-slate-950 to-blue-950 text-white")}
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
      className={cx("min-h-[100svh] w-full", "bg-gradient-to-b from-slate-950 via-slate-950 to-blue-950 text-white")}
      style={{
        paddingTop: "max(env(safe-area-inset-top), 18px)",
        paddingBottom: "max(env(safe-area-inset-bottom), 18px)",
      }}
    >
      <div className="mx-auto flex min-h-[100svh] max-w-md flex-col px-4">
        {/* Header */}
        <header className="pt-2">
          <TopBar title="Word Quick" />

          {/* HERO card like screenshot */}
          <GlassCard className="mt-4 overflow-hidden">
            <div className="relative p-5">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.10] via-transparent to-transparent" />
              <div className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full bg-blue-500/10 blur-[70px]" />
              <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-500/12 blur-[80px]" />

              <div className="relative z-[2] flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-white/65">Game mode</div>
                  <div className="mt-1 text-[22px] font-extrabold tracking-tight text-white/95 leading-tight">
                    Word Quick
                  </div>
                  <div className="mt-2 text-[12px] text-white/60">
                    {activeWindow ? "Pick fast → answer instantly." : "Waiting → start automatically."} •{" "}
                    <span className="text-white/75">{headerRight}</span>
                  </div>

                  {/* optional small debug line (kept but visually subtle) */}
                  <div className="mt-2 text-[10px] text-white/35">Round key: {activeRoundKey}</div>
                </div>

                <RightCapsule label="Time" value={timeLabel} />
              </div>

              <div className="mt-4 flex items-center gap-2">
                <Pill tone={activeWindow ? "live" : "neutral"}>{activeWindow ? "● LIVE" : "SOON"}</Pill>
                <Pill>{locked ? "1 attempt used" : "1 attempt"}</Pill>
                <Pill>⏱ 2 min window</Pill>
              </div>
            </div>
          </GlassCard>
        </header>

        {/* Main */}
        <section className="mt-4 space-y-3">
          {/* Word card */}
          <GlassCard className={cx("overflow-hidden", activeWindow ? "border-emerald-400/14" : undefined)}>
            <div className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[12px] text-white/65">
                  {activeWindow ? `Active interval • ${activeInterval} min` : `Next drop • ${nextDrop.interval} min`}
                </div>

                <span className={cx("text-[11px] font-semibold", locked ? "text-rose-100" : "text-white/70")}>
                  {locked ? "Locked" : "Ready"}
                </span>
              </div>

              <div className="mt-4">
                {activeWindow ? (
                  <div className="select-none text-[44px] font-extrabold leading-none tracking-tight">
                    {scrambled || "…"}
                  </div>
                ) : (
                  <div className="text-[13px] text-white/60">Word is hidden. Get ready.</div>
                )}
              </div>

              {/* After attempt: reveal answer */}
              {locked && attempt.answer ? (
                <div className="mt-4 rounded-[20px] border border-white/10 bg-slate-950/25 p-4">
                  <div className="text-[11px] text-white/50">Correct word</div>
                  <div className="mt-1 text-[16px] font-extrabold tracking-tight text-white/95">
                    {attempt.answer}
                  </div>
                  <div className="mt-1 text-[11px] text-white/50">
                    Your answer: <span className="text-white/80">{attempt.userAnswer || "—"}</span>
                  </div>
                </div>
              ) : null}
            </div>
          </GlassCard>

          {/* Input + CTA */}
          <GlassCard className="overflow-hidden">
            <div className="p-5">
              <div className="text-[12px] font-semibold text-white/75">Type the correct word</div>

              <div className="mt-3 flex items-end gap-3">
                <div className="min-w-0 flex-1">
                  <input
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder={!activeWindow ? "Wait for the round…" : locked ? "Locked until next round" : "Type here…"}
                    disabled={!canType}
                    className={cx(
                      "w-full rounded-[22px] border px-4 py-3 text-[15px] outline-none",
                      "shadow-[0_18px_50px_rgba(0,0,0,0.30)] backdrop-blur-[10px]",
                      "focus:ring-2 focus:ring-blue-400/25",
                      canType
                        ? "border-white/12 bg-slate-950/40 text-white placeholder:text-white/35 focus:border-white/25"
                        : "border-white/10 bg-slate-950/20 text-white/40 placeholder:text-white/25"
                    )}
                  />
                </div>

                <button
                  onClick={onSend}
                  disabled={!canType || answer.trim().length === 0}
                  className={cx(
                    "shrink-0 rounded-[22px] border px-5 py-3 text-[14px] font-extrabold transition active:scale-[0.98] touch-manipulation",
                    "shadow-[0_18px_55px_rgba(0,0,0,0.40)] backdrop-blur-[10px]",
                    canType && answer.trim().length > 0
                      ? "border-blue-300/22 bg-gradient-to-b from-blue-500/22 to-blue-500/10 hover:-translate-y-[1px] hover:shadow-[0_0_45px_rgba(59,130,246,0.28)]"
                      : "border-white/10 bg-white/5 opacity-50"
                  )}
                  style={{ minWidth: 110 }}
                >
                  {submitting ? "Sending…" : "Send"}
                </button>
              </div>

              {/* Result */}
              {result ? (
                <div
                  className={cx(
                    "mt-4 rounded-[22px] border px-4 py-3",
                    result.ok && result.correct
                      ? "border-emerald-400/22 bg-emerald-500/12"
                      : "border-rose-400/22 bg-rose-500/12"
                  )}
                >
                  {result.serverError ? (
                    <div className="text-[12px] font-semibold">Error ❌ — {result.serverError}</div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[13px] font-extrabold">
                          {result.correct ? "Correct ✅" : `Wrong ❌ — ${result.serverAnswer ?? "?"}`}
                        </div>
                        <div className="mt-0.5 text-[11px] font-semibold text-white/65">
                          {result.interval} min • {result.ms} ms
                        </div>
                      </div>

                      <div className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[12px] font-extrabold text-white/90">
                        +{result.points}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {/* Hint */}
              <div className="mt-3 text-[11px] text-white/50">
                {locked
                  ? "You already used your attempt. Next round unlocks automatically."
                  : "One attempt only. If you miss, we’ll reveal the correct word."}
              </div>
            </div>
          </GlassCard>

          {/* Duration (styled like screenshot) */}
          <GlassCard className="overflow-hidden">
            <div className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[13px] font-extrabold text-white/90">Duration</div>
                <div className="text-[11px] text-white/45">30m (+5) or 60m (00)</div>
              </div>

              <div className="mt-3 space-y-3">
                {ALL_INTERVALS.map((i) => {
                  const selected = !!enabledIntervals[i];
                  const badge = selected ? "Selected" : "Tap";
                  const subtitle =
                    i === 30 ? "More frequent drops (+5 offset)" : "Classic hourly drops (00 offset)";

                  return (
                    <SelectCard
                      key={i}
                      title={i === 30 ? "30 minutes" : "1 hour"}
                      subtitle={subtitle}
                      selected={selected}
                      onClick={() => toggleInterval(i)}
                      icon={i === 30 ? "⏱️" : "🕒"}
                      rightBadge={badge}
                    />
                  );
                })}
              </div>
            </div>
          </GlassCard>

          {/* Settings (icon-only) */}
          <details className="rounded-[26px] border border-white/10 bg-white/[0.06] shadow-[0_22px_70px_rgba(0,0,0,0.46)] backdrop-blur-[12px] overflow-hidden">
            <summary className="cursor-pointer list-none px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-white/65">Options</div>
                  <div className="mt-1 text-[13px] font-extrabold text-white/90">
                    Participation & Notifications
                  </div>
                </div>

                {/* icon-only "settings" */}
                <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/6 shadow-[0_14px_40px_rgba(0,0,0,0.42)]">
                  <span className="text-[18px] leading-none">⚙️</span>
                </div>
              </div>
            </summary>

            <div className="px-5 pb-5 pt-1">
              <div className="text-[12px] font-extrabold text-white/85">Participation</div>

              <label className="mt-3 flex items-center justify-between rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">
                <div className="min-w-0">
                  <div className="text-[13px] font-extrabold text-white/90">Participate</div>
                  <div className="mt-1 text-[11px] text-white/55">Get notified and join timed words</div>
                </div>
                <input
                  type="checkbox"
                  className="h-6 w-6 accent-blue-400"
                  checked={participate}
                  onChange={(e) => setParticipate(e.target.checked)}
                />
              </label>

              <button
                onClick={requestNotifications}
                className={cx(
                  "mt-3 w-full rounded-[24px] border border-blue-300/22",
                  "bg-gradient-to-b from-blue-500/20 to-blue-500/10 px-5 py-4 text-left transition",
                  "shadow-[0_18px_55px_rgba(0,0,0,0.40)] backdrop-blur-[12px]",
                  "hover:-translate-y-[1px] hover:shadow-[0_0_45px_rgba(59,130,246,0.28)] active:scale-[0.98] touch-manipulation"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[14px] font-extrabold">Enable notifications</div>
                    <div className="mt-1 text-[11px] text-white/65">“Word incoming in 1 minute”</div>
                  </div>
                  <span className="text-white/40 text-[18px]">›</span>
                </div>
              </button>

              <div className="mt-2 text-[11px] text-white/40">
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
