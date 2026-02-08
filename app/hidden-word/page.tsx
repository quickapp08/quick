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

function normalizeWord(raw: string) {
  return raw.toLowerCase().replace(/[^a-z]/g, "");
}

function countLetters(str: string) {
  const map: Record<string, number> = {};
  for (const ch of str.toUpperCase().replace(/[^A-Z]/g, "")) map[ch] = (map[ch] || 0) + 1;
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

// Reject letters that contain too-obvious chunks from base words (e.g. "EAST", "RING")
function containsObviousChunk(letters: string, baseWords: string[]) {
  const L = letters.toUpperCase();
  for (const w of baseWords) {
    const up = w.toUpperCase();
    // check contiguous substrings length 4..6 (more "obvious" visually)
    for (let k = 4; k <= Math.min(6, up.length); k++) {
      for (let i = 0; i + k <= up.length; i++) {
        const sub = up.slice(i, i + k);
        if (L.includes(sub)) return true;
      }
    }
  }
  return false;
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

    const { data, error } = await supabase
      .from("hidden_word_dictionary")
      .select("word,len")
      .order("len", { ascending: true });

    if (error) {
      setDictErr(error.message);
      return;
    }

    const rowsRaw = (data ?? []).map((r: any) => {
      const clean = normalizeWord(String(r.word || ""));
      return {
        word: clean,
        len: Number(r.len ?? clean.length),
      };
    });

    // keep only valid a-z words, len 2..12 (feel free to tweak)
    const rows = rowsRaw
      .filter((x) => x.word && /^[a-z]+$/.test(x.word) && x.word.length >= 2 && x.word.length <= 12)
      .map((x) => ({ word: x.word, len: x.word.length })) as DictWord[];

    setDict(rows);
    setDictSet(new Set(rows.map((x) => x.word)));
  };

  useEffect(() => {
    if (!authReady || !userId) return;
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    loadDictionary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, userId]);

  // round state
  const [startMs, setStartMs] = useState(0);

  const [letters, setLetters] = useState("");
  const lettersMap = useMemo(() => countLetters(letters), [letters]);

  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [found, setFound] = useState<string[]>([]);
  const foundSet = useMemo(() => new Set(found), [found]);

  const [score, setScore] = useState(0);

  // nicer toast system
  const [toast, setToast] = useState<{ title: string; body?: string; tone: "ok" | "warn" } | null>(
    null
  );
  const toastTimer = useRef<number | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const msLeft = useMemo(() => {
    if (phase !== "playing") return totalMs;
    return Math.max(0, startMs + totalMs - nowMs);
  }, [phase, startMs, totalMs, nowMs]);

  const timeLabel = useMemo(() => msToClock(msLeft), [msLeft]);

  const showToast = (title: string, body: string | undefined, tone: "ok" | "warn" = "ok") => {
    setToast({ title, body, tone });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1100);
  };

  // Generate letters (10–14) that guarantee >=10 dictionary words and avoid obvious chunks
  const generateLettersGuaranteed = (seedKey: string) => {
    if (!dict || dict.length < 60) return { letters: "", guaranteedWords: [] as string[] };

    const rand = mulberry32(hashToUint32(seedKey));

    const candidates = dict.filter((w) => w.len >= 3 && w.len <= 7);

    const pick = () => {
      const w = candidates[Math.floor(rand() * candidates.length)];
      return w?.word || "apple";
    };

    const targetLen = 10 + Math.floor(rand() * 5); // 10..14

    for (let attempt = 0; attempt < 400; attempt++) {
      // pick 10 base words
      const base: string[] = [];
      while (base.length < 10) {
        const w = pick();
        if (!base.includes(w)) base.push(w);
      }

      let L = unionLettersForWords(base);

      // grow if too short
      while (L.length < targetLen) {
        const extra = pick();
        L = unionLettersForWords([...base, extra]);
      }

      // if too long, retry
      if (L.length > 14) continue;

      // add 0-2 "decoy" letters to make patterns less readable (still keep <=14)
      // use letters from random candidate words so it stays “realistic”
      let withDecoys = L;
      const decoyCount = Math.floor(rand() * 3); // 0..2
      for (let i = 0; i < decoyCount; i++) {
        const w = pick().toUpperCase();
        const ch = w[Math.floor(rand() * w.length)] || "A";
        if (withDecoys.length < 14) withDecoys += ch;
      }

      // shuffle hard
      const mixed = shuffleStringDeterministic(withDecoys, seedKey).toUpperCase();

      // ensure exact 10..14
      const trimmed = mixed.slice(0, Math.min(14, mixed.length));
      if (trimmed.length < 10) continue;

      // avoid obvious readable chunks from base words
      if (containsObviousChunk(trimmed, base)) continue;

      // ensure >=10 possible words from dictionary (strict)
      const map = countLetters(trimmed);
      const possible = candidates
        .map((w) => w.word)
        .filter((w) => canBuild(w, map));

      const uniquePossible = Array.from(new Set(possible));
      if (uniquePossible.length >= 10) {
        // also ensure there is at least some diversity: not all 3-letter
        const longCount = uniquePossible.filter((w) => w.length >= 6).length;
        if (longCount < 2) continue;

        return { letters: trimmed, guaranteedWords: base };
      }
    }

    // fallback: still from dict, shuffled, not a readable phrase
    const fallbackWords = (dict.filter((w) => w.len >= 4 && w.len <= 7).slice(0, 12) || []).map(
      (x) => x.word
    );
    const fb = unionLettersForWords(fallbackWords).slice(0, 14);
    return { letters: shuffleStringDeterministic(fb, seedKey).toUpperCase(), guaranteedWords: [] };
  };

  const startRound = () => {
    if (!dict || !dictSet) {
      showToast("Loading…", "Dictionary is not ready yet", "warn");
      return;
    }

    const key = `${Date.now()}:${Math.random().toString(16).slice(2)}`;

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

      if (error) setSaveMsg("Score not saved (check RLS/policy). Gameplay is OK.");
      else setSaveMsg("Score saved ✅");
    } catch {
      setSaveMsg("Score not saved (DB not ready).");
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

  const praiseForWord = (len: number) => {
    if (len <= 3) return "Bravo!";
    if (len >= 6) return "Fantastic!";
    return "Nice!";
  };

  const submitWord = () => {
    if (phase !== "playing") return;
    if (!dictSet) return;

    const word = normalizeWord(input);
    if (!word) return;

    if (word.length < 2) {
      showToast("Too short", "Try 2+ letters", "warn");
      return;
    }

    // strict dictionary (after normalization)
    if (!dictSet.has(word)) {
      showToast("Not accepted", "Try another word", "warn");
      setInput("");
      return;
    }

    if (foundSet.has(word)) {
      showToast("Already found", undefined, "warn");
      setInput("");
      return;
    }

    if (!canBuild(word, lettersMap)) {
      showToast("Not possible", "Letters don't match", "warn");
      setInput("");
      return;
    }

    const pts = pointsForLen(word.length);
    setFound((prev) => [word, ...prev]);
    setScore((s) => s + pts);
    setInput("");

    showToast(praiseForWord(word.length), `+${pts} pts`, "ok");
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
    setFound([]);
    setScore(0);
    setInput("");
    setToast(null);
    setSaving(false);
    setSaveMsg(null);
  };

  const lettersArray = useMemo(() => letters.split("").filter(Boolean), [letters]);

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
        <header className="pt-2">
          <TopBar title="Hidden Word" />

          <div className="mt-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[22px] font-extrabold tracking-tight">Hidden Word</h1>
              <div className="mt-1 text-[12px] text-white/60">
                {phase === "setup"
                  ? "Find as many words as you can in 60 seconds."
                  : phase === "playing"
                  ? "Type a word and hit Enter."
                  : "Round complete."}
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <div
                className={cx(
                  "rounded-full border px-3 py-1 text-[11px] font-semibold",
                  phase === "playing"
                    ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
                    : "border-blue-300/25 bg-blue-500/10 text-blue-100"
                )}
              >
                {phase === "playing" ? "LIVE" : "READY"}
              </div>

              <div className="rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[11px] font-semibold text-white/85">
                ⏱ {phase === "playing" ? timeLabel : "1:00"}
              </div>
            </div>
          </div>

          {dictErr ? (
            <div className="mt-3 rounded-2xl border border-rose-400/25 bg-rose-500/10 p-3 text-[12px] text-white/85">
              Dictionary load error: {dictErr}
            </div>
          ) : null}
        </header>

        <section className="mt-4 space-y-3">
          {/* Main card */}
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.42)] backdrop-blur-[10px]">
            <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-blue-500/14 blur-3xl" />
            <div className="pointer-events-none absolute -left-16 bottom-[-90px] h-48 w-48 rounded-full bg-blue-500/10 blur-3xl" />

            <div className="relative z-[2] flex items-center justify-between">
              <div className="text-[12px] text-white/65">Score</div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[12px] font-extrabold text-white/90">
                🧩 {score} pts
              </div>
            </div>

            <div className="relative z-[2] mt-3">
              <div className="text-[12px] text-white/65">Letters</div>

              {/* Letters grid (looks like a game, not a string) */}
              <div className="mt-2 rounded-3xl border border-white/10 bg-slate-950/35 p-3">
                <div className="grid grid-cols-7 gap-2">
                  {lettersArray.length ? (
                    lettersArray.map((ch, idx) => (
                      <div
                        key={`${ch}-${idx}`}
                        className="grid h-10 w-full place-items-center rounded-2xl border border-white/12 bg-white/6 text-[16px] font-extrabold tracking-tight shadow-[0_10px_30px_rgba(0,0,0,0.28)]"
                      >
                        {ch}
                      </div>
                    ))
                  ) : (
                    <div className="col-span-7 rounded-2xl border border-white/10 bg-white/5 p-4 text-center text-[12px] text-white/60">
                      Press Start to generate letters.
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="text-[11px] text-white/50">
                  1–3: +1 • 4–5: +2 • 6+: +3
                </div>
                <div className="text-[11px] text-white/55">
                  Found: <span className="text-white/85 font-semibold">{found.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Setup */}
          {phase === "setup" ? (
            <div className="rounded-3xl border border-white/12 bg-white/6 p-4">
              <button
                onClick={startRound}
                className={cx(
                  "group relative overflow-hidden w-full rounded-3xl border border-blue-300/25",
                  "bg-gradient-to-b from-blue-500/22 to-blue-500/10",
                  "px-5 py-4 text-left transition touch-manipulation",
                  "hover:-translate-y-[1px] hover:border-blue-300/45 hover:shadow-[0_0_45px_rgba(59,130,246,0.28)]",
                  "active:scale-[0.98]"
                )}
                disabled={!dict || !dictSet}
              >
                <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-blue-500/16 blur-2xl" />
                <div className="relative z-[2] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl border border-blue-300/25 bg-blue-500/12 text-[16px]">
                      ▶️
                    </div>
                    <div>
                      <div className="text-[15px] font-extrabold">Start</div>
                      <div className="mt-1 text-[11px] text-white/65">
                        Letters are generated to be solvable (no obvious combos).
                      </div>
                    </div>
                  </div>
                  <div className="text-white/55">→</div>
                </div>
              </button>

              <div className="mt-3 text-[11px] text-white/45">
                Tip: You can’t reuse a letter more times than it appears.
              </div>
            </div>
          ) : null}

          {/* Playing */}
          {phase === "playing" ? (
            <>
              <div className="rounded-3xl border border-white/12 bg-white/6 p-4">
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
                        "mt-2 w-full rounded-2xl border px-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-blue-400/60",
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
                      "text-[13px] font-extrabold transition hover:-translate-y-[1px] hover:shadow-[0_0_40px_rgba(59,130,246,0.22)]",
                      "active:scale-[0.98] touch-manipulation"
                    )}
                    style={{ minWidth: 96 }}
                  >
                    Add
                  </button>
                </div>

                {/* Toast */}
                {toast ? (
                  <div
                    className={cx(
                      "mt-3 rounded-2xl border px-3 py-2",
                      toast.tone === "ok"
                        ? "border-emerald-400/25 bg-emerald-500/10"
                        : "border-rose-400/25 bg-rose-500/10"
                    )}
                  >
                    <div className="text-[12px] font-extrabold text-white/90">{toast.title}</div>
                    {toast.body ? (
                      <div className="mt-0.5 text-[11px] text-white/70">{toast.body}</div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-3 text-[11px] text-white/45">
                    Keep going — speed matters. ⌁
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-white/12 bg-white/6 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-[12px] font-extrabold text-white/90">
                    Found words ({found.length})
                  </div>
                  <div className="text-[11px] text-white/55">latest first</div>
                </div>

                {found.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {found.slice(0, 28).map((w) => (
                      <span
                        key={w}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12px] font-semibold text-white/90"
                      >
                        {w}
                        <span className="text-white/45">+{pointsForLen(w.length)}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 text-[12px] text-white/55">No words yet.</div>
                )}

                {found.length > 28 ? (
                  <div className="mt-2 text-[11px] text-white/45">
                    Showing first 28 to keep UI clean.
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {/* Done */}
          {phase === "done" ? (
            <div className="rounded-3xl border border-white/12 bg-white/6 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[15px] font-extrabold text-white/92">Finished</div>
                  <div className="mt-1 text-[12px] text-white/65">
                    Words: <b>{found.length}</b> • Score: <b>{score}</b>
                  </div>
                </div>
                <div className="rounded-full border border-white/12 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/85">
                  🧩 {score} pts
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/80">
                {saving ? "Saving score…" : saveMsg ?? "Score ready."}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={resetToSetup}
                  className="rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-[13px] font-extrabold text-white/85 transition hover:bg-white/10 active:scale-[0.98] touch-manipulation"
                >
                  New round
                </button>
                <Link
                  href="/leaderboard"
                  className="rounded-2xl border border-blue-300/25 bg-gradient-to-b from-blue-500/25 to-blue-500/10 px-4 py-3 text-center text-[13px] font-extrabold text-white/92 transition hover:-translate-y-[1px] hover:shadow-[0_0_40px_rgba(59,130,246,0.22)] active:scale-[0.98] touch-manipulation"
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
