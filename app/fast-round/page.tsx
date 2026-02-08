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
        className={cx(
          "inline-flex items-center gap-2 rounded-2xl border px-3 py-2",
          "border-white/10 bg-white/5 text-[13px] font-semibold text-white/85",
          "shadow-[0_14px_40px_rgba(0,0,0,0.35)] backdrop-blur-[10px]",
          "transition hover:bg-white/10 active:scale-[0.98] touch-manipulation"
        )}
      >
        <span className="text-[14px] leading-none">←</span>
        <span>Back</span>
      </Link>

      <div className="text-[13px] font-semibold text-white/75">{title}</div>

      <div className="w-[72px]" />
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
  let w =
    FALLBACK_WORDS[Math.floor(rand() * FALLBACK_WORDS.length)] || "street";
  if (avoid && w === avoid) {
    w =
      FALLBACK_WORDS[(FALLBACK_WORDS.indexOf(w) + 7) % FALLBACK_WORDS.length] ||
      w;
  }
  return w.toLowerCase();
}

type Phase = "setup" | "playing" | "done";

/* ---------- UI atoms (design only) ---------- */

function StatusPill({ phase }: { phase: Phase }) {
  const tone =
    phase === "playing"
      ? "border-emerald-300/25 bg-emerald-500/12 text-emerald-50"
      : phase === "done"
      ? "border-blue-300/22 bg-blue-500/12 text-blue-50"
      : "border-white/12 bg-white/6 text-white/85";

  const icon = phase === "playing" ? "🟢" : phase === "done" ? "🏁" : "⚡";
  const label =
    phase === "playing" ? "LIVE" : phase === "done" ? "FINISHED" : "READY";

  return (
    <div
      className={cx(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-extrabold",
        "backdrop-blur-[10px] shadow-[0_14px_40px_rgba(0,0,0,0.35)]",
        tone
      )}
    >
      <span className="text-[13px] leading-none">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06]",
        "shadow-[0_22px_70px_rgba(0,0,0,0.46)] backdrop-blur-[12px]",
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.10] via-transparent to-transparent"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-14 -top-14 h-36 w-36 rounded-full bg-blue-500/14 blur-2xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -left-16 bottom-[-90px] h-56 w-56 rounded-full bg-blue-500/10 blur-3xl"
        aria-hidden="true"
      />
      <div className="relative z-[2]">{children}</div>
    </div>
  );
}

function SegButton({
  active,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "relative overflow-hidden rounded-3xl border px-4 py-4 text-left",
        "shadow-[0_16px_48px_rgba(0,0,0,0.42)] backdrop-blur-[12px] transition",
        "active:scale-[0.98] touch-manipulation",
        active
          ? "border-blue-300/22 bg-gradient-to-b from-blue-500/22 to-blue-500/10"
          : "border-white/10 bg-white/5 hover:bg-white/8"
      )}
    >
      {active ? (
        <>
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-blue-500/14 blur-2xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-white/6"
            aria-hidden="true"
          />
        </>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15px] font-extrabold text-white/92">{title}</div>
          <div className="mt-0.5 text-[12px] text-white/60">{subtitle}</div>
        </div>

        <div
          className={cx(
            "shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-extrabold",
            active
              ? "border-blue-300/18 bg-blue-500/10 text-blue-100"
              : "border-white/10 bg-white/6 text-white/70"
          )}
        >
          {active ? "Selected" : "Tap"}
        </div>
      </div>
    </button>
  );
}

function PrimaryCTA({
  title,
  subtitle,
  onClick,
  disabled,
}: {
  title: string;
  subtitle?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "group relative w-full overflow-hidden rounded-3xl border px-5 py-5 text-left",
        "border-blue-300/22 bg-gradient-to-b from-blue-500/28 to-blue-500/12",
        "shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-[12px] transition",
        "hover:-translate-y-[1px] hover:shadow-[0_0_70px_rgba(59,130,246,0.25)]",
        "active:scale-[0.98] touch-manipulation",
        disabled ? "opacity-60 pointer-events-none" : ""
      )}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-blue-500/20 blur-2xl"
        aria-hidden="true"
      />
      <div
        className={cx(
          "pointer-events-none absolute -left-44 top-0 h-full w-44 rotate-[20deg]",
          "bg-gradient-to-r from-transparent via-white/16 to-transparent blur-xl",
          "transition-transform duration-700 ease-out",
          "group-hover:translate-x-[560px]"
        )}
        aria-hidden="true"
      />

      <div className="relative z-[2] flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[18px] font-extrabold tracking-tight text-white/95">
            {title}
          </div>
          {subtitle ? (
            <div className="mt-1 text-[12px] text-white/65">{subtitle}</div>
          ) : null}
        </div>

        <div className="grid h-12 w-12 place-items-center rounded-2xl border border-blue-300/18 bg-blue-500/12">
          <span className="text-[18px] leading-none">▶</span>
        </div>
      </div>
    </button>
  );
}

function ScrambleBoard({ text, phase }: { text: string; phase: Phase }) {
  const chars = (text || "…").split("");
  return (
    <div
      className={cx(
        "rounded-3xl border p-4",
        phase === "playing"
          ? "border-emerald-300/18 bg-emerald-500/10"
          : "border-white/10 bg-white/5"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold text-white/60">Scrambled</div>
        <div className="text-[11px] text-white/45">Solve it fast</div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-2">
        {chars.map((c, i) => (
          <div
            key={`${c}-${i}`}
            className={cx(
              "grid h-11 w-full place-items-center rounded-2xl border",
              "bg-slate-950/30 shadow-[0_12px_34px_rgba(0,0,0,0.35)]",
              phase === "playing" ? "border-emerald-300/16" : "border-white/10"
            )}
          >
            <span className="text-[18px] font-extrabold text-white/95">
              {c.toUpperCase()}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-[11px] text-white/55">
          Enter = submit • Correct = next instantly
        </div>
      </div>
    </div>
  );
}

/* -------------------- Page (logic unchanged) -------------------- */

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
  const [roundKey, setRoundKey] = useState<string>("");
  const [startMs, setStartMs] = useState<number>(0);
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [score, setScore] = useState<number>(0);

  const [word, setWord] = useState<string>("");
  const [scrambled, setScrambled] = useState<string>("");
  const [answer, setAnswer] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

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
    setSaving(true);
    setSaveMsg(null);

    try {
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

  useEffect(() => {
    if (phase !== "playing") return;
    if (msLeft > 0) return;

    setPhase("done");
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    (async () => {
      await endRound();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msLeft, phase]);

  const onSubmit = () => {
    if (phase !== "playing") return;
    if (!word) return;

    const a = answer.trim().toLowerCase();
    if (!a) return;

    if (a === word) {
      const nextScore = score + 1;
      setScore(nextScore);
      genNextWord(nextScore, word);
    }
  };

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
            <h1 className="mt-5 text-[26px] font-extrabold tracking-tight">
              Fast Round
            </h1>
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
        "relative min-h-[100svh] w-full text-white",
        "bg-gradient-to-b from-slate-950 via-slate-950 to-blue-950 overflow-x-hidden overscroll-x-none touch-pan-y"
      )}
      style={{
        paddingTop: "max(env(safe-area-inset-top), 18px)",
        paddingBottom: "max(env(safe-area-inset-bottom), 18px)",
      }}
    >
      {/* brighter glow bg */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-24 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-blue-500/12 blur-[70px]" />
        <div className="absolute top-[240px] left-[-140px] h-[420px] w-[420px] rounded-full bg-blue-500/10 blur-[70px]" />
        <div className="absolute bottom-[-180px] right-[-180px] h-[520px] w-[520px] rounded-full bg-blue-500/10 blur-[80px]" />
      </div>

      <div className="relative mx-auto flex min-h-[100svh] max-w-md flex-col px-4">
        {/* Header */}
        <header className="pt-2">
          <TopBar title="Fast Round" />

          <div className="mt-5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-white/65">
                Game mode
              </div>
              <h1 className="mt-1 text-[28px] font-extrabold tracking-tight text-white/95 leading-tight">
                Fast Round
              </h1>
              <div className="mt-2 text-[12px] text-white/55">
                {phase === "setup"
                  ? "Pick duration → hit Start."
                  : phase === "playing"
                  ? "Correct = next word instantly."
                  : "Finished. Check your score."}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-extrabold text-white/90">
                  <span className="text-[13px] leading-none">🏁</span>
                  {score}
                </div>

                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-extrabold text-white/90">
                  <span className="text-[13px] leading-none">⏱</span>
                  {phase === "playing"
                    ? timeLabel
                    : lenSec === 30
                    ? "0:30"
                    : "1:00"}
                </div>
              </div>
            </div>

            <div className="shrink-0">
              <StatusPill phase={phase} />
            </div>
          </div>
        </header>

        {/* add bottom padding so content never hides under sticky CTA */}
        <section className="mt-5 space-y-3 pb-28">
          {phase === "setup" ? (
            <Card>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="text-[12px] font-semibold text-white/80">
                    Duration
                  </div>
                  <div className="text-[11px] text-white/45">30s or 60s</div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2">
                  <SegButton
                    active={lenSec === 30}
                    title="30 seconds"
                    subtitle="Best for quick sessions"
                    onClick={() => setLenSec(30)}
                  />
                  <SegButton
                    active={lenSec === 60}
                    title="1 minute"
                    subtitle="More words, more pressure"
                    onClick={() => setLenSec(60)}
                  />
                </div>

                <div className="mt-3 text-[11px] text-white/45">
                  Score = number of correct words in time.
                </div>
              </div>
            </Card>
          ) : null}

          {phase === "playing" ? (
            <>
              <ScrambleBoard text={scrambled} phase={phase} />

              <Card>
                <div className="p-4">
                  <label className="block text-[12px] font-semibold text-white/70">
                    Type the correct word
                  </label>

                  <input
                    ref={inputRef}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Type here…"
                    className={cx(
                      "mt-2 w-full rounded-2xl border px-4 py-3 text-[16px] outline-none",
                      "border-white/10 bg-slate-950/35 text-white placeholder:text-white/35",
                      "shadow-[0_14px_40px_rgba(0,0,0,0.35)] backdrop-blur-[10px]",
                      "focus:border-blue-300/25 focus:ring-2 focus:ring-blue-400/50"
                    )}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    inputMode="text"
                  />

                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-[11px] text-white/45">
                      Enter = submit • Correct = next
                    </div>

                    <button
                      onClick={onSubmit}
                      className={cx(
                        "rounded-2xl border border-blue-300/18 bg-blue-500/12 px-4 py-2",
                        "text-[12px] font-extrabold text-white/90",
                        "shadow-[0_14px_40px_rgba(0,0,0,0.35)] backdrop-blur-[10px] transition",
                        "hover:bg-white/10 active:scale-[0.98] touch-manipulation"
                      )}
                    >
                      Send
                    </button>
                  </div>
                </div>
              </Card>
            </>
          ) : null}

          {phase === "done" ? (
            <Card>
              <div className="p-4">
                <div className="text-[12px] font-semibold text-white/70">
                  Result
                </div>
                <div className="mt-1 text-[18px] font-extrabold text-white/95">
                  Finished
                </div>
                <div className="mt-2 text-[12px] text-white/65">
                  You solved <b className="text-white/90">{score}</b>{" "}
                  {score === 1 ? "word" : "words"} in {lenSec}s.
                </div>

                <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/80">
                  {saving ? "Saving score…" : saveMsg ?? "Score ready."}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={resetToSetup}
                    className={cx(
                      "rounded-3xl border border-white/10 bg-white/5 px-4 py-3",
                      "text-[13px] font-extrabold text-white/90",
                      "shadow-[0_16px_48px_rgba(0,0,0,0.42)] backdrop-blur-[12px] transition",
                      "hover:bg-white/8 active:scale-[0.98] touch-manipulation"
                    )}
                  >
                    New round
                  </button>

                  <Link
                    href="/leaderboard"
                    className={cx(
                      "rounded-3xl border border-blue-300/18 bg-gradient-to-b from-blue-500/22 to-blue-500/10 px-4 py-3 text-center",
                      "text-[13px] font-extrabold text-white/92",
                      "shadow-[0_16px_48px_rgba(0,0,0,0.42)] backdrop-blur-[12px] transition",
                      "hover:-translate-y-[1px] hover:shadow-[0_0_55px_rgba(59,130,246,0.18)] active:scale-[0.98] touch-manipulation"
                    )}
                  >
                    Leaderboard
                  </Link>
                </div>
              </div>
            </Card>
          ) : null}
        </section>

        {/* ✅ Sticky HERO CTA (setup only) */}
        {phase === "setup" ? (
          <div
            className="fixed left-0 right-0 bottom-0 z-[50]"
            style={{
              paddingBottom: "max(env(safe-area-inset-bottom), 14px)",
            }}
          >
            <div className="mx-auto max-w-md px-4">
              {/* ✅ removed the gradient strip that created the “background behind CTA” */}
              <PrimaryCTA
                title="Start"
                subtitle="First word appears instantly"
                onClick={startRound}
              />
            </div>
          </div>
        ) : null}

        <footer className="mt-auto pb-2 pt-6 text-center text-[11px] text-white/35">
          Quick • Fast Round
        </footer>
      </div>
    </main>
  );
}
