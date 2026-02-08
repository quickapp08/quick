"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Phase = "setup" | "playing" | "done";

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

function pointsForLen(n: number) {
  if (n <= 3) return 1; // 1–3
  if (n <= 5) return 2; // 4–5
  return 3; // 6+
}

function countLetters(str: string) {
  const map: Record<string, number> = {};
  for (const ch of str.toUpperCase()) map[ch] = (map[ch] || 0) + 1;
  return map;
}

function canBuild(word: string, lettersMap: Record<string, number>) {
  const w = word.toUpperCase().replace(/[^A-Z]/g, "");
  if (!w) return false;
  const need: Record<string, number> = {};
  for (const ch of w) need[ch] = (need[ch] || 0) + 1;
  for (const ch of Object.keys(need)) {
    if ((lettersMap[ch] || 0) < need[ch]) return false;
  }
  return true;
}

// deterministic RNG (stable per round)
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

type DictWord = { word: string; len: number };

function unionLettersForWords(words: string[]) {
  const need: Record<string, number> = {};
  for (const w of words) {
    const up = w.toUpperCase();
    const local: Record<string, number> = {};
    for (const ch of up) local[ch] = (local[ch] || 0) + 1;
    for (const ch of Object.keys(local)) {
      need[ch] = Math.max(need[ch] || 0, local[ch]);
    }
  }
  // expand multiset into string
  let out = "";
  const keys = Object.keys(need).sort();
  for (const ch of keys) out += ch.repeat(need[ch] || 0);
  return out;
}

function shuffleStringDeterministic(str: string, seedKey: string) {
  const arr = str.split("");
  const rand = mulberry32(hashToUint32(seedKey));
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join("");
}

export default function HiddenWordPage() {
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

  const ROUND_SECONDS = 60;
  const totalMs = ROUND_SECONDS * 1000;

  const [phase, setPhase] = useState<Phase>("setup");
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 120);
    return () => window.clearInterval(id);
  }, []);

  // dictionary
  const [dict, setDict] = useState<DictWord[] | null>(null);
  const [dictSet, setDictSet] = useState<Set<string> | null>(null);
  const [dictErr, setDictErr] = useState<string | null>(null);

  const loadDictionary = async () => {
    setDictErr(null);
    // keep it simple: pull all
    const { data, error } = await supabase
      .from("hidden_word_dictionary")
      .select("word,len")
      .order("len", { ascending: true });

    if (error) {
      setDictErr(error.message);
      return;
    }
    const rows = (data ?? []).map((r: any) => ({
      word: String(r.word || "").toLowerCase(),
      len: Number(r.len || String(r.word || "").length),
    })) as DictWord[];

    setDict(rows);
    setDictSet(new Set(rows.map((x) => x.word)));
  };

  useEffect(() => {
    if (!authReady || !userId) return;
    // load once
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    loadDictionary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, userId]);

  // round state
  const [roundKey, setRoundKey] = useState("");
  const [startMs, setStartMs] = useState(0);

  const [letters, setLetters] = useState("");
  const lettersMap = useMemo(() => countLetters(letters), [letters]);

  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [found, setFound] = useState<string[]>([]);
  const foundSet = useMemo(() => new Set(found), [found]);

  const [score, setScore] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const msLeft = useMemo(() => {
    if (phase !== "playing") return totalMs;
    return Math.max(0, startMs + totalMs - nowMs);
  }, [phase, startMs, totalMs, nowMs]);

  const timeLabel = useMemo(() => msToClock(msLeft), [msLeft]);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 900);
  };

  // Generate letters (10–14) that guarantee >=10 dictionary words
  const generateLettersGuaranteed = (seedKey: string) => {
    if (!dict || dict.length < 50) return { letters: "", guaranteedWords: [] as string[] };

    const rand = mulberry32(hashToUint32(seedKey));

    // prefer mid-length words for better overlap
    const candidates = dict.filter((w) => w.len >= 3 && w.len <= 7);
    const pick = () => candidates[Math.floor(rand() * candidates.length)]?.word || "apple";

    for (let attempt = 0; attempt < 200; attempt++) {
      // pick 10 base words (guaranteed solvable)
      const base: string[] = [];
      while (base.length < 10) {
        const w = pick();
        if (!base.includes(w)) base.push(w);
      }

      let L = unionLettersForWords(base); // multiset union
      // if too short, add extra letters from another word
      while (L.length < 10) {
        const extra = pick();
        L = unionLettersForWords([...base, extra]);
      }

      // if too long, retry (we need 10–14)
      if (L.length > 14) continue;

      // shuffle deterministically so it looks random
      const mixed = shuffleStringDeterministic(L, seedKey).slice(0, 14);

      // Now ensure >=10 words from dictionary can be built (not just base list)
      const map = countLetters(mixed);
      const possible = candidates
        .filter((w) => w.len >= 2 && w.len <= 10)
        .map((w) => w.word)
        .filter((w) => canBuild(w, map));

      // require at least 10 unique possible words
      const uniquePossible = Array.from(new Set(possible));
      if (uniquePossible.length >= 10) {
        return { letters: mixed.toUpperCase(), guaranteedWords: base };
      }
    }

    // fallback: just return something from fixed pool (still playable)
    const fallback = "EASTRINGLOW".toUpperCase();
    return { letters: fallback, guaranteedWords: [] as string[] };
  };

  const startRound = () => {
    if (!dict || !dictSet) {
      flash("Dictionary not loaded yet");
      return;
    }

    const key = `${Date.now()}:${Math.random().toString(16).slice(2)}`;
    setRoundKey(key);

    const gen = generateLettersGuaranteed(key);
    setLetters(gen.letters);

    setFound([]);
    setScore(0);
    setInput("");
    setToast(null);
    setSaveMsg(null);
    setSaving(false);

    const t0 = Date.now();
    setStartMs(t0);
    setPhase("playing");

    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const endRound = async () => {
    setPhase("done");
    setSaving(true);
    setSaveMsg(null);

    try {
      const { error } = await supabase.from("hidden_word_scores").insert({
        user_id: userId,
        duration_sec: ROUND_SECONDS,
        letters,
        found_words: found,
        words_count: found.length,
        score,
      });

      if (error) {
        setSaveMsg("Score not saved yet (check table/policy). Gameplay is OK.");
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

  const submitWord = () => {
    if (phase !== "playing") return;
    if (!dictSet) return;

    const raw = input.trim().toLowerCase();
    const word = raw.replace(/[^a-z]/g, "");
    if (!word) return;

    if (word.length < 2) {
      flash("Too short");
      return;
    }

    // must exist in system (dictionary)
    if (!dictSet.has(word)) {
      flash("Word not in dictionary");
      setInput("");
      return;
    }

    if (foundSet.has(word)) {
      flash("Already found");
      setInput("");
      return;
    }

    if (!canBuild(word, lettersMap)) {
      flash("Not possible with these letters");
      setInput("");
      return;
    }

    const pts = pointsForLen(word.length);
    setFound((prev) => [word, ...prev]);
    setScore((s) => s + pts);
    setInput("");
    flash(`+${pts}`);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitWord();
    }
  };

  const resetToSetup = () => {
    setPhase("setup");
    setLetters("");
    setRoundKey("");
    setFound([]);
    setScore(0);
    setInput("");
    setToast(null);
    setSaving(false);
    setSaveMsg(null);
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
            <TopBar title="Hidden Word" />
            <h1 className="mt-5 text-2xl font-bold tracking-tight">Hidden Word</h1>
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
      <div className="mx-auto flex min-h-[100svh] max-w-md flex-col px-4">
        <header className="pt-2">
          <TopBar title="Hidden Word" />

          <div className="mt-4 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-[22px] font-bold tracking-tight">Hidden Word</h1>
              <div className="mt-1 text-[12px] text-white/60">
                {phase === "setup"
                  ? "Find as many valid words as you can"
                  : phase === "playing"
                  ? "Enter a word — Enter = submit"
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
            >
              {phase === "playing" ? "LIVE" : "READY"}
            </div>
          </div>

          {dictErr ? (
            <div className="mt-3 rounded-2xl border border-rose-400/25 bg-rose-500/10 p-3 text-[12px] text-white/85">
              Dictionary load error: {dictErr}
            </div>
          ) : null}
        </header>

        <section className="mt-4 space-y-3">
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
                {phase === "setup" ? "Round: 60s" : phase === "playing" ? "Time left" : "Ended"}
              </div>
              <div className="text-[12px] font-semibold text-white/85">
                {phase === "playing" ? timeLabel : "1:00"}
              </div>
            </div>

            <div className="mt-3">
              <div className="text-[12px] text-white/60">Letters</div>
              <div className="mt-2 select-none rounded-2xl border border-white/12 bg-slate-950/35 px-4 py-3">
                <div className="text-[26px] font-extrabold tracking-[0.16em] text-white/95">
                  {letters || "—"}
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div className="text-[11px] text-white/55">
                1–3 letters: 1pt • 4–5: 2pt • 6+: 3pt
              </div>
              <div className="rounded-full border border-white/12 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/85">
                {score} pts
              </div>
            </div>
          </div>

          {phase === "setup" ? (
            <div className="rounded-2xl border border-white/12 bg-white/6 p-4">
              <button
                onClick={startRound}
                className={cx(
                  "w-full rounded-2xl border border-blue-300/25",
                  "bg-gradient-to-b from-blue-500/25 to-blue-500/10 px-4 py-3 text-left",
                  "transition hover:-translate-y-[1px] hover:shadow-[0_0_40px_rgba(59,130,246,0.28)]",
                  "active:scale-[0.98] touch-manipulation"
                )}
                disabled={!dict || !dictSet}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-semibold">
                      {dict ? "Start" : "Loading words…"}
                    </div>
                    <div className="mt-0.5 text-[11px] text-white/65">
                      Letters will guarantee at least 10 valid words
                    </div>
                  </div>
                  <div className="text-white/55">→</div>
                </div>
              </button>

              <div className="mt-3 text-[11px] text-white/45">
                Rule: you can’t use a letter more times than it appears.
              </div>
            </div>
          ) : null}

          {phase === "playing" ? (
            <>
              <div className="rounded-2xl border border-white/12 bg-white/6 p-4">
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0 w-full">
                    <label className="block text-[12px] text-white/70">Type a word</label>
                    <input
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={onKeyDown}
                      placeholder="Enter a word..."
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
                    onClick={submitWord}
                    className={cx(
                      "shrink-0 rounded-2xl border border-blue-300/25 bg-gradient-to-b from-blue-500/25 to-blue-500/10 px-4 py-3",
                      "text-[13px] font-semibold transition hover:-translate-y-[1px] hover:shadow-[0_0_40px_rgba(59,130,246,0.22)]",
                      "active:scale-[0.98] touch-manipulation"
                    )}
                    style={{ minWidth: 96 }}
                  >
                    Add
                  </button>
                </div>

                {toast ? (
                  <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/85">
                    {toast}
                  </div>
                ) : (
                  <div className="mt-3 text-[11px] text-white/45">
                    Only dictionary words count.
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-white/12 bg-white/6 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-[12px] font-semibold text-white/85">
                    Found ({found.length})
                  </div>
                  <div className="text-[11px] text-white/55">latest first</div>
                </div>

                {found.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {found.slice(0, 24).map((w) => (
                      <span
                        key={w}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12px] font-semibold text-white/85"
                      >
                        {w}
                        <span className="text-white/45">+{pointsForLen(w.length)}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 text-[12px] text-white/55">No words yet.</div>
                )}

                {found.length > 24 ? (
                  <div className="mt-2 text-[11px] text-white/45">
                    Showing first 24 to keep UI clean.
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {phase === "done" ? (
            <div className="rounded-2xl border border-white/12 bg-white/6 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[14px] font-extrabold text-white/92">Finished</div>
                  <div className="mt-1 text-[12px] text-white/65">
                    Words: <b>{found.length}</b> • Score: <b>{score}</b>
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
            </div>
          ) : null}
        </section>

        <footer className="mt-auto pb-2 pt-6 text-center text-[11px] text-white/35">
          Quick • Hidden Word
        </footer>
      </div>
    </main>
  );
}
