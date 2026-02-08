"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type RoundLen = 30 | 60;
const ALL_LENS: RoundLen[] = [30, 60];

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
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

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

// Fallback word bank (works immediately). Later we can replace with DB/RPC.
const FALLBACK_WORDS = [
  "street",
  "camera",
  "planet",
  "school",
  "orange",
  "silver",
  "danger",
  "window",
  "animal",
  "future",
  "shadow",
  "thunder",
  "rocket",
  "summer",
  "winter",
  "memory",
  "bridge",
  "forest",
  "smooth",
  "coffee",
  "pencil",
  "broken",
  "hidden",
  "guitar",
  "castle",
  "market",
  "mother",
  "father",
  "friend",
  "energy",
  "signal",
  "random",
  "secret",
  "player",
  "global",
  "modern",
  "silent",
  "mirror",
  "charge",
  "battle",
  "victory",
];

function pickWordDeterministic(seed: string, avoid?: string) {
  const rand = mulberry32(hashToUint32(seed));
  let w = FALLBACK_WORDS[Math.floor(rand() * FALLBACK_WORDS.length)] || "street";
  // small avoid loop to not repeat instantly
  if (avoid && w === avoid) {
    w = FALLBACK_WORDS[(FALLBACK_WORDS.indexOf(w) + 7) % FALLBACK_WORDS.length] || w;
  }
  return w.toLowerCase();
}

type Phase = "setup" | "playing" | "done";

export default function FastRoundPage() {
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
        router.replace("/auth?mode=login");
        return;
      }
      setUserId(uid);
      setAuthReady(true);
    };

    boot();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      if (!uid) router.replace("/auth?mode=login");
      else setAuthReady(true);
    });

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe();
    };
  }, [router]);

  const [phase, setPhase] = useState<Phase>("setup");
  const [lenSec, setLenSec] = useState<RoundLen>(30);

  // gameplay state
  const [roundKey, setRoundKey] = useState<string>(""); // unique id for this run
  const [startMs, setStartMs] = useState<number>(0);
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [score, setScore] = useState<number>(0);

  const [word, setWord] = useState<string>("");
  const [scrambled, setScrambled] = useState<string>("");
  const [answer, setAnswer] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  // ticker
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 100);
    return () => window.clearInterval(id);
  }, []);

  const totalMs = useMemo(() => lenSec * 1000, [lenSec]);
  const msLeft = useMemo(() => {
    if (phase !== "playing") return totalMs;
    return Math.max(0, startMs + totalMs - nowMs);
  }, [phase, startMs, totalMs, nowMs]);

  const timeLabel = useMemo(() => msToClock(msLeft), [msLeft]);

  const genNextWord = (nextIndex: number, prev?: string) => {
    const seed = `${roundKey}:${nextIndex}`;
    const w = pickWordDeterministic(seed, prev);
    const s = scrambleWordSeeded(w, seed);
    setWord(w);
    setScrambled(s);
    setAnswer("");
    // focus for mobile typing
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const startRound = () => {
    const key = `${Date.now()}:${Math.random().toString(16).slice(2)}`;
    setRoundKey(key);
    setScore(0);
    setSaveMsg(null);
    setSaving(false);

    const t0 = Date.now();
    setStartMs(t0);
    setPhase("playing");

    // first word
    // index 0
    const seed = `${key}:0`;
    const w = pickWordDeterministic(seed);
    const s = scrambleWordSeeded(w, seed);
    setWord(w);
    setScrambled(s);
    setAnswer("");
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const endRound = async () => {
    setPhase("done");

    // try to save score (non-blocking; no crash if table not present)
    setSaving(true);
    setSaveMsg(null);

    try {
      // You can create this table later:
      // fast_round_scores: id, user_id, duration_sec, score, created_at
      const { error } = await supabase.from("fast_round_scores").insert({
        user_id: userId,
        duration_sec: lenSec,
        score,
      });

      if (error) {
        setSaveMsg(
          `Score not saved yet (missing DB table or policy). Gameplay is OK.`
        );
      } else {
        setSaveMsg("Score saved ✅");
      }
    } catch {
      setSaveMsg("Score not saved yet (DB not ready).");
    } finally {
      setSaving(false);
    }
  };

  // auto-end when timer hits 0
  useEffect(() => {
    if (phase !== "playing") return;
    if (msLeft > 0) return;
    // prevent multiple calls
    setPhase("done");
    // end round async
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    (async () => {
      await endRound();
    })();
    // we intentionally only react to msLeft reaching 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msLeft, phase]);

  // submit logic: correct -> next instantly
  const onSubmit = () => {
    if (phase !== "playing") return;
    if (!word) return;

    const a = answer.trim().toLowerCase();
    if (!a) return;

    if (a === word) {
      const nextScore = score + 1;
      setScore(nextScore);

      // next word index = nextScore (so deterministic but changes every correct)
      genNextWord(nextScore, word);
      return;
    }

    // wrong: just keep typing (no animation to keep it clean)
  };

  // Enter = submit
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSubmit();
    }
  };

  const resetToSetup = () => {
    setPhase("setup");
    setScore(0);
    setWord("");
    setScrambled("");
    setAnswer("");
    setSaveMsg(null);
    setSaving(false);
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
            <TopBar title="Fast Round" />
            <h1 className="mt-5 text-2xl font-bold tracking-tight">Fast Round</h1>
            <p className="mt-2 text-[13px] leading-relaxed text-white/70">
              Redirecting to login…
            </p>
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
      <div className="mx-auto flex min-h-[100svh] max-w-md flex-col px-4">
        {/* Header */}
        <header className="pt-2">
          <TopBar title="Fast Round" />

          <div className="mt-4 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-[22px] font-bold tracking-tight">Fast Round</h1>
              <div className="mt-1 text-[12px] text-white/60">
                {phase === "setup"
                  ? "Pick duration and start instantly"
                  : phase === "playing"
                  ? "Type fast — next word instantly on correct"
                  : "Round finished"}
              </div>
            </div>

            <div
              className={cx(
                "shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold",
                phase === "playing"
                  ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
                  : "border-blue-300/25 bg-blue-500/10 text-blue-100"
              )}
              title={phase === "playing" ? "Round live" : "Not started"}
            >
              {phase === "playing" ? "LIVE" : "READY"}
            </div>
          </div>
        </header>

        <section className="mt-4 space-y-3">
          {/* Main card */}
          <div
            className={cx(
              "rounded-2xl border p-4",
              phase === "playing"
                ? "border-emerald-400/20 bg-emerald-500/10"
                : "border-blue-300/20 bg-blue-500/10"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="text-[12px] text-white/70">
                {phase === "setup"
                  ? "Choose: 30s or 60s"
                  : phase === "playing"
                  ? `${lenSec}s round`
                  : `${lenSec}s round ended`}
              </div>

              <div className="text-[12px] font-semibold text-white/85">
                {phase === "playing" ? timeLabel : lenSec === 30 ? "0:30" : "1:00"}
              </div>
            </div>

            <div className="mt-3">
              {phase === "playing" ? (
                <div className="select-none text-[42px] font-extrabold leading-none tracking-tight">
                  {scrambled || "…"}
                </div>
              ) : (
                <div className="text-[13px] text-white/60">
                  Scrambled words. Correct = next instantly.
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div className="text-[11px] text-white/55">
                Score = correct words
              </div>
              <div className="rounded-full border border-white/12 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/85">
                {score} pts
              </div>
            </div>
          </div>

          {/* Setup controls */}
          {phase === "setup" ? (
            <div className="rounded-2xl border border-white/12 bg-white/6 p-4">
              <div className="text-[12px] font-semibold text-white/85">Duration</div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                {ALL_LENS.map((s) => {
                  const active = lenSec === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setLenSec(s)}
                      className={cx(
                        "rounded-2xl border px-4 py-3 text-left transition active:scale-[0.98] touch-manipulation",
                        active
                          ? "border-blue-300/25 bg-gradient-to-b from-blue-500/25 to-blue-500/10 hover:-translate-y-[1px] hover:shadow-[0_0_40px_rgba(59,130,246,0.22)]"
                          : "border-white/12 bg-white/5 hover:bg-white/10"
                      )}
                    >
                      <div className="text-[14px] font-extrabold text-white/92">
                        {s === 30 ? "30 seconds" : "1 minute"}
                      </div>
                      <div className="mt-0.5 text-[11px] text-white/60">
                        Score = how many you solve
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={startRound}
                className={cx(
                  "mt-3 w-full rounded-2xl border border-blue-300/25",
                  "bg-gradient-to-b from-blue-500/25 to-blue-500/10 px-4 py-3 text-left",
                  "transition hover:-translate-y-[1px] hover:shadow-[0_0_40px_rgba(59,130,246,0.28)]",
                  "active:scale-[0.98] touch-manipulation"
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-semibold">Start</div>
                    <div className="mt-0.5 text-[11px] text-white/65">
                      First word appears instantly
                    </div>
                  </div>
                  <div className="text-white/55">→</div>
                </div>
              </button>
            </div>
          ) : null}

          {/* Input + Submit */}
          {phase === "playing" ? (
            <div className="rounded-2xl border border-white/12 bg-white/6 p-4">
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0 w-full">
                  <label className="block text-[12px] text-white/70">
                    Type the correct word (Enter = submit)
                  </label>
                  <input
                    ref={inputRef}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Type here..."
                    className={cx(
                      "mt-2 w-full rounded-xl border px-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-blue-400/60",
                      "border-white/12 bg-slate-950/40 text-white placeholder:text-white/35"
                    )}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    inputMode="text"
                  />
                </div>

                <button
                  onClick={onSubmit}
                  className={cx(
                    "shrink-0 rounded-2xl border border-blue-300/25 bg-gradient-to-b from-blue-500/25 to-blue-500/10 px-4 py-3",
                    "text-[13px] font-semibold transition hover:-translate-y-[1px] hover:shadow-[0_0_40px_rgba(59,130,246,0.22)]",
                    "active:scale-[0.98] touch-manipulation"
                  )}
                  style={{ minWidth: 96 }}
                >
                  Send
                </button>
              </div>

              <div className="mt-2 text-[11px] text-white/45">
                Tip: don’t waste time — if you’re stuck, just guess and move on.
              </div>
            </div>
          ) : null}

          {/* Done screen */}
          {phase === "done" ? (
            <div className="rounded-2xl border border-white/12 bg-white/6 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[14px] font-extrabold text-white/92">
                    Finished
                  </div>
                  <div className="mt-1 text-[12px] text-white/65">
                    You solved <b>{score}</b> {score === 1 ? "word" : "words"}.
                  </div>
                </div>
                <div className="rounded-full border border-white/12 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/85">
                  {score} pts
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/80">
                {saving ? "Saving score…" : saveMsg ?? "Score ready."}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={resetToSetup}
                  className="rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-[13px] font-semibold text-white/85 transition hover:bg-white/10 active:scale-[0.98] touch-manipulation"
                >
                  New round
                </button>
                <Link
                  href="/leaderboard"
                  className="rounded-2xl border border-blue-300/25 bg-gradient-to-b from-blue-500/25 to-blue-500/10 px-4 py-3 text-center text-[13px] font-semibold text-white/92 transition hover:-translate-y-[1px] hover:shadow-[0_0_40px_rgba(59,130,246,0.22)] active:scale-[0.98] touch-manipulation"
                >
                  Leaderboard
                </Link>
              </div>

              <div className="mt-2 text-[11px] text-white/45">
                Next: we’ll connect this to Fast Round leaderboard (30s / 60s tabs).
              </div>
            </div>
          ) : null}
        </section>

        <footer className="mt-auto pb-2 pt-6 text-center text-[11px] text-white/35">
          Quick • Fast Round
        </footer>
      </div>
    </main>
  );
}
