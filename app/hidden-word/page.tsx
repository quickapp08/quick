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
        className="rounded-2xl border border-white/12 bg-white/6 px-3 py-2 text-[13px] text-white/80 transition hover:bg-white/10 active:scale-[0.98] touch-manipulation"
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
  if (n <= 3) return 1;
  if (n <= 5) return 2;
  return 3;
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

/* ---------- deterministic RNG ---------- */
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
function shuffleStringDeterministic(str: string, seedKey: string) {
  const arr = str.split("");
  const rand = mulberry32(hashToUint32(seedKey));
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join("");
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

// “Harder” shuffle to avoid obvious chunks at the start (east/ring etc.)
function shuffleLettersHarder(
  letters: string,
  seedKey: string,
  dictSet: Set<string> | null
) {
  let best = shuffleStringDeterministic(letters, seedKey);
  if (!dictSet) return best;

  const score = (s: string) => {
    let p = 0;
    for (let i = 0; i + 4 <= s.length; i++) {
      const chunk = s.slice(i, i + 4).toLowerCase();
      if (dictSet.has(chunk)) p += 2;
    }
    const badStarts = ["east", "ring", "tion", "ment", "ness", "able", "ing"];
    for (const b of badStarts) if (s.toLowerCase().startsWith(b)) p += 3;
    return p;
  };

  let bestScore = score(best);
  for (let k = 0; k < 18; k++) {
    const cand = shuffleStringDeterministic(letters, `${seedKey}:${k}`);
    const sc = score(cand);
    if (sc < bestScore) {
      best = cand;
      bestScore = sc;
      if (bestScore === 0) break;
    }
  }
  return best;
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

  // ✅ Keyboard spacer via CSS variable (does NOT push layout; only adds scroll room)
  const [kbPx, setKbPx] = useState(0);
  useEffect(() => {
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    if (!vv) return;

    const onResize = () => {
      const diff = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKbPx(diff);
      document.documentElement.style.setProperty("--kb", `${diff}px`);
    };

    onResize();
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onResize);
    };
  }, []);

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

    const rows = (data ?? []).map((r: any) => ({
      word: String(r.word || "").toLowerCase(),
      len: Number(r.len || String(r.word || "").length),
    })) as DictWord[];

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
  const [roundKey, setRoundKey] = useState("");
  const [startMs, setStartMs] = useState(0);

  const [letters, setLetters] = useState("");
  const lettersMap = useMemo(() => countLetters(letters), [letters]);

  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [found, setFound] = useState<string[]>([]);
  const foundSet = useMemo(() => new Set(found), [found]);

  const [score, setScore] = useState(0);

  const [toast, setToast] = useState<{ text: string; tone: "ok" | "warn" | "bad" } | null>(
    null
  );
  const toastTimerRef = useRef<number | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const msLeft = useMemo(() => {
    if (phase !== "playing") return totalMs;
    return Math.max(0, startMs + totalMs - nowMs);
  }, [phase, startMs, totalMs, nowMs]);

  const timeLabel = useMemo(() => msToClock(msLeft), [msLeft]);

  const showToast = (text: string, tone: "ok" | "warn" | "bad" = "ok") => {
    setToast({ text, tone });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 1400);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Ensure input stays in view when keyboard opens (but letters stay sticky)
  useEffect(() => {
    if (phase !== "playing") return;
    if (!kbPx) return;
    window.setTimeout(() => {
      inputRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 60);
  }, [kbPx, phase]);

  const generateLettersGuaranteed = (seedKey: string) => {
    if (!dict || dict.length < 50) return { letters: "", guaranteedWords: [] as string[] };

    const rand = mulberry32(hashToUint32(seedKey));
    const candidates = dict.filter((w) => w.len >= 3 && w.len <= 7);
    const pick = () => candidates[Math.floor(rand() * candidates.length)]?.word || "apple";

    for (let attempt = 0; attempt < 240; attempt++) {
      const base: string[] = [];
      while (base.length < 10) {
        const w = pick();
        if (!base.includes(w)) base.push(w);
      }

      let L = unionLettersForWords(base);
      while (L.length < 10) {
        const extra = pick();
        L = unionLettersForWords([...base, extra]);
      }
      if (L.length > 14) continue;

      const mixed = shuffleLettersHarder(L.toUpperCase(), seedKey, dictSet).slice(0, 14);

      const map = countLetters(mixed);
      const possible = candidates
        .filter((w) => w.len >= 2 && w.len <= 10)
        .map((w) => w.word)
        .filter((w) => canBuild(w, map));

      const uniquePossible = Array.from(new Set(possible));
      if (uniquePossible.length >= 10) return { letters: mixed.toUpperCase(), guaranteedWords: base };
    }

    return { letters: shuffleLettersHarder("EASTRINGLOW", seedKey, dictSet).toUpperCase(), guaranteedWords: [] };
  };

  const startRound = () => {
    if (!dict || !dictSet) {
      showToast("Loading words…", "warn");
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

      setSaveMsg(error ? "Score not saved (policy/table). Gameplay is OK." : "Score saved ✅");
    } catch {
      setSaveMsg("Score not saved yet (DB not ready).");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (phase !== "playing") return;
    if (msLeft > 0) return;
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    endRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msLeft, phase]);

  const submitWord = () => {
    if (phase !== "playing") return;
    if (!dictSet) return;

    const raw = input.trim().toLowerCase();
    const word = raw.replace(/[^a-z]/g, "");
    if (!word) return;

    if (word.length < 2) {
      showToast("Too short", "warn");
      setInput("");
      return;
    }
    if (foundSet.has(word)) {
      showToast("Already found", "warn");
      setInput("");
      return;
    }
    if (!canBuild(word, lettersMap)) {
      showToast("Not possible with these letters", "bad");
      setInput("");
      return;
    }
    if (!dictSet.has(word)) {
      showToast("Not in our dictionary (yet)", "bad");
      setInput("");
      return;
    }

    const pts = pointsForLen(word.length);
    setFound((prev) => [word, ...prev]);
    setScore((s) => s + pts);
    setInput("");

    if (word.length <= 3) showToast(`Bravo! +${pts}`, "ok");
    else showToast(`Fantastic! +${pts}`, "ok");
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

  const lettersGrid = useMemo(() => {
    const arr = letters ? letters.split("") : [];
    return { first: arr.slice(0, 7), second: arr.slice(7, 14) };
  }, [letters]);

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
        "min-h-[100svh] w-full overflow-x-hidden",
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

          <div className="mt-5 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-[26px] font-extrabold tracking-tight text-white/95">Hidden Word</h1>
              <div className="mt-1 text-[12px] text-white/65">
                {phase === "setup"
                  ? "Find as many words as you can from the letters."
                  : phase === "playing"
                  ? "Type a word and hit Enter."
                  : "Round finished."}
              </div>
            </div>

            <div className="flex items-center gap-2">
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

        {/* Scroll area only */}
        <section
          className="mt-4 flex-1 overflow-y-auto overscroll-contain space-y-3 pb-4"
          style={{
            // add extra scroll room for keyboard, but DON'T push the whole layout
            paddingBottom: `calc(16px + max(env(safe-area-inset-bottom), 18px) + var(--kb, 0px))`,
          }}
        >
          {/* Sticky letters card (always visible while typing) */}
          <div className="sticky top-0 z-10 pt-1">
            <div className="rounded-[28px] border border-white/10 bg-white/[0.06] shadow-[0_22px_70px_rgba(0,0,0,0.46)] backdrop-blur-[12px]">
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="text-[12px] text-white/65">Score</div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[12px] font-semibold text-white/90">
                    🧩 {score} pts
                  </div>
                </div>

                <div className="mt-4 text-[12px] text-white/65">Letters</div>

                <div className="mt-3 rounded-[24px] border border-white/10 bg-slate-950/35 p-3">
                  <div className="grid grid-cols-7 gap-2">
                    {(lettersGrid.first.length ? lettersGrid.first : Array.from({ length: 7 }).map(() => "•")).map(
                      (ch, idx) => (
                        <div
                          key={`a_${idx}`}
                          className="grid aspect-square place-items-center rounded-2xl border border-white/10 bg-white/5 text-[18px] font-extrabold text-white/95 shadow-[0_12px_34px_rgba(0,0,0,0.35)]"
                        >
                          {ch}
                        </div>
                      )
                    )}
                  </div>

                  <div className="mt-2 grid grid-cols-7 gap-2">
                    {(lettersGrid.second.length ? lettersGrid.second : Array.from({ length: 7 }).map(() => "•")).map(
                      (ch, idx) => (
                        <div
                          key={`b_${idx}`}
                          className="grid aspect-square place-items-center rounded-2xl border border-white/10 bg-white/5 text-[18px] font-extrabold text-white/95 shadow-[0_12px_34px_rgba(0,0,0,0.35)]"
                        >
                          {ch}
                        </div>
                      )
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-white/55">
                    <div>1–3: +1 • 4–5: +2 • 6+: +3</div>
                    <div>Found: {found.length}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {phase === "setup" ? (
            <div className="rounded-[28px] border border-white/10 bg-white/[0.06] shadow-[0_22px_70px_rgba(0,0,0,0.46)] backdrop-blur-[12px]">
              <div className="p-4">
                <button
                  onClick={startRound}
                  disabled={!dict || !dictSet}
                  className={cx(
                    "w-full rounded-2xl border border-blue-300/25",
                    "bg-gradient-to-b from-blue-500/25 to-blue-500/10 px-4 py-4 text-left",
                    "transition hover:-translate-y-[1px] hover:shadow-[0_0_40px_rgba(59,130,246,0.22)]",
                    "active:scale-[0.98] touch-manipulation",
                    !dict || !dictSet ? "opacity-60" : ""
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[15px] font-extrabold">
                        {!dict ? "Loading words…" : "Start"}
                      </div>
                      <div className="mt-1 text-[12px] text-white/70">
                        60 seconds — find as many words as possible.
                      </div>
                    </div>
                    <div className="text-white/60 text-[18px]">›</div>
                  </div>
                </button>
              </div>
            </div>
          ) : null}

          {phase === "playing" ? (
            <>
              <div className="rounded-[28px] border border-white/10 bg-white/[0.06] shadow-[0_22px_70px_rgba(0,0,0,0.46)] backdrop-blur-[12px]">
                <div className="p-4">
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
                          "mt-2 w-full rounded-2xl border px-4 py-4 text-[16px] outline-none",
                          "border-white/12 bg-slate-950/35 text-white placeholder:text-white/30",
                          "focus:border-blue-300/30 focus:ring-2 focus:ring-blue-400/50"
                        )}
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        inputMode="text"
                      />
                      <div className="mt-2 text-[11px] text-white/45">
                        Keep going — speed matters. ⌁
                      </div>
                    </div>

                    <button
                      onClick={submitWord}
                      className={cx(
                        "shrink-0 rounded-2xl border border-blue-300/25 bg-gradient-to-b from-blue-500/25 to-blue-500/10 px-5 py-4",
                        "text-[14px] font-extrabold transition hover:-translate-y-[1px] hover:shadow-[0_0_40px_rgba(59,130,246,0.20)]",
                        "active:scale-[0.98] touch-manipulation"
                      )}
                      style={{ minWidth: 108 }}
                    >
                      Add
                    </button>
                  </div>

                  {toast ? (
                    <div
                      className={cx(
                        "mt-3 rounded-2xl border px-3 py-2 text-[12px] font-semibold",
                        toast.tone === "ok"
                          ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
                          : toast.tone === "warn"
                          ? "border-amber-300/20 bg-amber-500/10 text-amber-100"
                          : "border-rose-300/20 bg-rose-500/10 text-rose-100"
                      )}
                    >
                      {toast.text}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/[0.06] shadow-[0_22px_70px_rgba(0,0,0,0.46)] backdrop-blur-[12px]">
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-[14px] font-extrabold text-white/92">
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
                </div>
              </div>
            </>
          ) : null}

          {phase === "done" ? (
            <div className="rounded-[28px] border border-white/10 bg-white/[0.06] shadow-[0_22px_70px_rgba(0,0,0,0.46)] backdrop-blur-[12px]">
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[16px] font-extrabold text-white/95">Finished</div>
                    <div className="mt-1 text-[12px] text-white/65">
                      Words: <b>{found.length}</b> • Score: <b>{score}</b>
                    </div>
                  </div>
                  <div className="rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[12px] font-extrabold text-white/90">
                    {score} pts
                  </div>
                </div>

                <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/80">
                  {saving ? "Saving score…" : saveMsg ?? "Score ready."}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={resetToSetup}
                    className="rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-[13px] font-extrabold text-white/90 transition hover:bg-white/10 active:scale-[0.98] touch-manipulation"
                  >
                    New round
                  </button>
                  <Link
                    href="/leaderboard"
                    className="rounded-2xl border border-blue-300/25 bg-gradient-to-b from-blue-500/25 to-blue-500/10 px-4 py-3 text-center text-[13px] font-extrabold text-white/95 transition hover:-translate-y-[1px] hover:shadow-[0_0_40px_rgba(59,130,246,0.18)] active:scale-[0.98] touch-manipulation"
                  >
                    Leaderboard
                  </Link>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <footer className="pb-2 pt-2 text-center text-[11px] text-white/35">
          Quick • Hidden Word
        </footer>
      </div>
    </main>
  );
}
