"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Phase = "setup" | "playing" | "done";
type FlashTone = "ok" | "bad" | "info";

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

// deterministic RNG (stable per round key)
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

function shuffleArrayDeterministic<T>(arr: T[], seedKey: string) {
  const a = [...arr];
  const rand = mulberry32(hashToUint32(seedKey));
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Tile = {
  id: string;
  ch: string; // uppercase letter
};

function makeTiles(letters: string, seedKey: string): Tile[] {
  const arr = letters.toUpperCase().split("");
  const shuffled = shuffleArrayDeterministic(arr, `tiles:${seedKey}`);
  return shuffled.map((ch, idx) => ({
    id: `${seedKey}:${idx}:${ch}`,
    ch,
  }));
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
      .select("word") // ✅ don't touch generated len
      .order("word", { ascending: true });

    if (error) {
      setDictErr(error.message);
      return;
    }

    const rows = (data ?? [])
      .map((r: any) => String(r.word || "").toLowerCase().trim())
      .filter(Boolean);

    const list: DictWord[] = rows.map((w) => ({ word: w, len: w.length }));

    setDict(list);
    setDictSet(new Set(list.map((x) => x.word)));
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

  const [letters, setLetters] = useState(""); // stored for DB
  const lettersMap = useMemo(() => countLetters(letters), [letters]);

  const [tiles, setTiles] = useState<Tile[]>([]);

  // selection state (tap letters)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedWord = useMemo(() => {
    const map = new Map(tiles.map((t) => [t.id, t.ch] as const));
    return selectedIds.map((id) => map.get(id) ?? "").join("");
  }, [selectedIds, tiles]);

  // Found + scoring
  const [found, setFound] = useState<string[]>([]);
  const foundSet = useMemo(() => new Set(found), [found]);
  const [score, setScore] = useState(0);

  // Feedback coloring for the whole selection after Send
  const [lockTone, setLockTone] = useState<null | "ok" | "bad">(null);
  const clearLockTimerRef = useRef<number | null>(null);

  const [toast, setToast] = useState<{ tone: FlashTone; title: string; sub?: string } | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const msLeft = useMemo(() => {
    if (phase !== "playing") return totalMs;
    return Math.max(0, startMs + totalMs - nowMs);
  }, [phase, startMs, totalMs, nowMs]);

  const timeLabel = useMemo(() => msToClock(msLeft), [msLeft]);

  const flash = (tone: FlashTone, title: string, sub?: string) => {
    setToast({ tone, title, sub });
    window.setTimeout(() => setToast(null), 900);
  };

  const clearSelection = () => {
    setSelectedIds([]);
    setLockTone(null);
  };

  const safeClearLockLater = () => {
    if (clearLockTimerRef.current) window.clearTimeout(clearLockTimerRef.current);
    clearLockTimerRef.current = window.setTimeout(() => {
      setLockTone(null);
      setSelectedIds([]);
    }, 700);
  };

  useEffect(() => {
    return () => {
      if (clearLockTimerRef.current) window.clearTimeout(clearLockTimerRef.current);
    };
  }, []);

  // Generate letters (10–14) that guarantee >=10 dictionary words (best effort)
  const generateLettersGuaranteed = (seedKey: string) => {
    if (!dict || dict.length < 120) return { letters: "TABLESROCKET".toUpperCase(), ok: false };

    const rand = mulberry32(hashToUint32(seedKey));
    const candidates = dict.filter((w) => w.len >= 3 && w.len <= 7);
    const pick = () => candidates[Math.floor(rand() * candidates.length)]?.word || "table";

    for (let attempt = 0; attempt < 300; attempt++) {
      const base: string[] = [];
      while (base.length < 10) {
        const w = pick();
        if (!base.includes(w)) base.push(w);
      }

      const L = unionLettersForWords(base);
      if (L.length < 10 || L.length > 14) continue;

      const map = countLetters(L);
      const possible = candidates
        .filter((w) => w.len >= 2 && w.len <= 10)
        .map((w) => w.word)
        .filter((w) => canBuild(w, map));

      const uniquePossible = Array.from(new Set(possible));
      if (uniquePossible.length >= 10) return { letters: L.toUpperCase(), ok: true };
    }

    return { letters: "TABLESROCKET".toUpperCase(), ok: false };
  };

  const startRound = () => {
    if (!dict || !dictSet) {
      flash("info", "Loading…", "Dictionary is still syncing");
      return;
    }

    const key = `${Date.now()}:${Math.random().toString(16).slice(2)}`;
    setRoundKey(key);

    const gen = generateLettersGuaranteed(key);
    setLetters(gen.letters);
    setTiles(makeTiles(gen.letters, key));

    setFound([]);
    setScore(0);
    clearSelection();
    setToast(null);
    setSaveMsg(null);
    setSaving(false);

    const t0 = Date.now();
    setStartMs(t0);
    setPhase("playing");

    if (!gen.ok) flash("info", "Quick tip", "Add more words to dictionary for richer rounds.");
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

      if (error) setSaveMsg("Score not saved (policy/table). Game is OK.");
      else setSaveMsg("Saved ✅");
    } catch {
      setSaveMsg("Score not saved (DB not ready).");
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

  const onTapTile = (id: string) => {
    if (phase !== "playing") return;
    if (lockTone) return; // locked while showing ok/bad

    setSelectedIds((prev) => {
      // allow selecting same tile only once (id is unique)
      if (prev.includes(id)) return prev;
      return [...prev, id];
    });
  };

  const onBackspace = () => {
    if (phase !== "playing") return;
    if (lockTone) return;
    setSelectedIds((prev) => prev.slice(0, -1));
  };

  const onClear = () => {
    if (phase !== "playing") return;
    if (lockTone) return;
    clearSelection();
  };

  const submitSelected = () => {
    if (phase !== "playing") return;
    if (!dictSet) return;
    if (lockTone) return;

    const word = selectedWord.toLowerCase().replace(/[^a-z]/g, "");
    if (!word || word.length < 2) {
      flash("info", "Pick more letters");
      return;
    }

    // fits letters? (should always be true because we pick tiles, but keep safe)
    if (!canBuild(word, lettersMap)) {
      setLockTone("bad");
      flash("bad", "Nope", "Doesn't fit these letters");
      safeClearLockLater();
      return;
    }

    if (foundSet.has(word)) {
      setLockTone("bad");
      flash("bad", "Already found");
      safeClearLockLater();
      return;
    }

    if (!dictSet.has(word)) {
      setLockTone("bad");
      flash("bad", "Not a word", "Try again");
      safeClearLockLater();
      return;
    }

    const pts = pointsForLen(word.length);
    setFound((prev) => [word, ...prev]);
    setScore((s) => s + pts);

    setLockTone("ok");
    if (word.length >= 6) flash("ok", "Fantastic!", `+${pts} pts`);
    else flash("ok", "Bravo!", `+${pts} pts`);

    safeClearLockLater();
  };

  const resetToSetup = () => {
    setPhase("setup");
    setLetters("");
    setTiles([]);
    setRoundKey("");
    setFound([]);
    setScore(0);
    clearSelection();
    setSaving(false);
    setSaveMsg(null);
  };

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const tileClass = (id: string) => {
    const isSelected = selectedSet.has(id);

    // if locked after send, paint selected tiles green/red
    if (isSelected && lockTone === "ok") {
      return "border-emerald-300/25 bg-emerald-500/18 text-white shadow-[0_0_30px_rgba(16,185,129,0.18)]";
    }
    if (isSelected && lockTone === "bad") {
      return "border-rose-300/25 bg-rose-500/18 text-white shadow-[0_0_30px_rgba(244,63,94,0.18)]";
    }

    if (isSelected) {
      return "border-blue-300/30 bg-blue-500/18 text-white shadow-[0_0_30px_rgba(59,130,246,0.18)]";
    }

    return "border-white/12 bg-white/5 text-white/90";
  };

  if (!authReady || !userId) {
    return (
      <main
        className={cx(
          "min-h-[100dvh] w-full",
          "bg-gradient-to-b from-slate-950 via-slate-950 to-blue-950 text-white"
        )}
        style={{
          paddingTop: "max(env(safe-area-inset-top), 14px)",
          paddingBottom: "max(env(safe-area-inset-bottom), 14px)",
        }}
      >
        <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-4">
          <header className="pt-2">
            <TopBar title="Hidden Word" />
            <h1 className="mt-5 text-2xl font-bold tracking-tight">Hidden Word</h1>
            <p className="mt-2 text-[13px] leading-relaxed text-white/70">Redirecting…</p>
          </header>
        </div>
      </main>
    );
  }

  return (
    <main
      className={cx(
        "min-h-[100dvh] w-full",
        "bg-gradient-to-b from-slate-950 via-slate-950 to-blue-950 text-white"
      )}
      style={{
        paddingTop: "max(env(safe-area-inset-top), 14px)",
        paddingBottom: "max(env(safe-area-inset-bottom), 14px)",
      }}
    >
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-4">
        {/* Header */}
        <header className="pt-2">
          <TopBar title="Hidden Word" />

          <div className="mt-4 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-[24px] font-extrabold tracking-tight">Hidden Word</h1>
              <div className="mt-1 text-[12px] text-white/60">
                {phase === "setup"
                  ? "Tap letters to form words — no keyboard."
                  : phase === "playing"
                  ? "Tap letters, then press Send."
                  : "Round finished."}
              </div>
            </div>

            <div className="flex items-center gap-2">
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

              <div className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/80">
                ⏱ {phase === "playing" ? timeLabel : "1:00"}
              </div>
            </div>
          </div>

          {dictErr ? (
            <div className="mt-3 rounded-2xl border border-rose-400/25 bg-rose-500/10 p-3 text-[12px] text-white/85">
              Dictionary error: {dictErr}
            </div>
          ) : null}
        </header>

        {/* Game Card */}
        <section className="mt-4">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 shadow-[0_0_60px_rgba(59,130,246,0.10)] backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div className="text-[12px] text-white/65">Score</div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/85">
                🧩 <span className="text-[13px] font-extrabold">{score}</span> pts
              </div>
            </div>

            <div className="mt-3 rounded-[24px] border border-white/10 bg-slate-950/25 p-3">
              <div className="text-[12px] text-white/55">Letters</div>

              <div className="mt-3 grid grid-cols-7 gap-2">
                {(tiles.length ? tiles : Array.from({ length: 14 }, (_, i) => ({ id: `p-${i}`, ch: "•" }))).map(
                  (t) => (
                    <button
                      key={t.id}
                      onClick={() => onTapTile(t.id)}
                      disabled={phase !== "playing" || !tiles.length || !!lockTone || selectedSet.has(t.id)}
                      className={cx(
                        "grid aspect-square place-items-center rounded-2xl border text-[16px] font-extrabold",
                        "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] transition active:scale-[0.98] touch-manipulation",
                        tileClass(t.id),
                        (phase !== "playing" || !tiles.length) && "opacity-60",
                        selectedSet.has(t.id) && !lockTone && "ring-1 ring-white/6"
                      )}
                    >
                      {t.ch}
                    </button>
                  )
                )}
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-white/55">
                <div>1–3: +1 • 4–5: +2 • 6+: +3</div>
                <div>Found: {found.length}</div>
              </div>
            </div>

            {/* Selected word display + controls */}
            <div className="mt-3 rounded-[24px] border border-white/10 bg-white/5 p-3">
              <div className="text-[12px] text-white/60">Your word</div>

              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate rounded-2xl border border-white/10 bg-slate-950/25 px-4 py-3 text-[18px] font-extrabold tracking-[0.14em] text-white/90">
                    {selectedWord || "—"}
                  </div>
                  <div className="mt-1 text-[11px] text-white/45">
                    Tap letters to build • Back removes last
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={onBackspace}
                    disabled={phase !== "playing" || !selectedIds.length || !!lockTone}
                    className={cx(
                      "rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-[13px] font-semibold text-white/85",
                      "transition active:scale-[0.98] touch-manipulation",
                      (!selectedIds.length || !!lockTone) && "opacity-50"
                    )}
                  >
                    ⌫
                  </button>
                  <button
                    onClick={onClear}
                    disabled={phase !== "playing" || !selectedIds.length || !!lockTone}
                    className={cx(
                      "rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-[13px] font-semibold text-white/85",
                      "transition active:scale-[0.98] touch-manipulation",
                      (!selectedIds.length || !!lockTone) && "opacity-50"
                    )}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2">
                <button
                  onClick={submitSelected}
                  disabled={phase !== "playing" || selectedIds.length < 2 || !!lockTone}
                  className={cx(
                    "w-full rounded-[24px] border border-blue-300/25",
                    "bg-gradient-to-b from-blue-500/26 to-blue-500/10 px-5 py-4 text-left",
                    "transition hover:-translate-y-[1px] hover:shadow-[0_0_45px_rgba(59,130,246,0.28)]",
                    "active:scale-[0.98] touch-manipulation",
                    (selectedIds.length < 2 || !!lockTone) && "opacity-60"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[14px] font-semibold">Send</div>
                      <div className="mt-1 text-[11px] text-white/65">
                        {selectedIds.length < 2 ? "Pick at least 2 letters" : "Check word + score"}
                      </div>
                    </div>
                    <div className="text-white/55">→</div>
                  </div>
                </button>
              </div>

              {toast ? (
                <div
                  className={cx(
                    "mt-3 rounded-2xl border p-3 text-[12px] text-white/90",
                    toast.tone === "ok"
                      ? "border-emerald-300/25 bg-emerald-500/12"
                      : toast.tone === "bad"
                      ? "border-rose-300/25 bg-rose-500/12"
                      : "border-white/10 bg-white/5"
                  )}
                >
                  <div className="font-semibold">{toast.title}</div>
                  {toast.sub ? <div className="mt-0.5 text-white/70">{toast.sub}</div> : null}
                </div>
              ) : null}

              {phase === "setup" ? (
                <div className="mt-3">
                  <button
                    onClick={startRound}
                    className={cx(
                      "w-full rounded-[24px] border border-blue-300/25",
                      "bg-gradient-to-b from-blue-500/26 to-blue-500/10 px-5 py-4 text-left",
                      "transition hover:-translate-y-[1px] hover:shadow-[0_0_45px_rgba(59,130,246,0.28)]",
                      "active:scale-[0.98] touch-manipulation"
                    )}
                    disabled={!dict || !dictSet}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[14px] font-semibold">{dict ? "Start" : "Loading…"}</div>
                        <div className="mt-1 text-[11px] text-white/65">
                          Letters are generated to have plenty of valid words.
                        </div>
                      </div>
                      <div className="text-white/55">→</div>
                    </div>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {/* Found words */}
        <section className="mt-4 pb-6">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div className="text-[14px] font-extrabold text-white/92">
                Found words ({found.length})
              </div>
              <div className="text-[11px] text-white/50">latest first</div>
            </div>

            {found.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {found.slice(0, 40).map((w) => (
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

            {phase === "done" ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-[12px] text-white/80">
                {saving ? "Saving score…" : saveMsg ?? "Done."}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    onClick={resetToSetup}
                    className="rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-[13px] font-semibold text-white/85 transition hover:bg-white/10 active:scale-[0.98] touch-manipulation"
                  >
                    New round
                  </button>
                  <Link
                    href="/leaderboard"
                    className="rounded-2xl border border-blue-300/25 bg-gradient-to-b from-blue-500/26 to-blue-500/10 px-4 py-3 text-center text-[13px] font-semibold text-white/92 transition hover:-translate-y-[1px] hover:shadow-[0_0_40px_rgba(59,130,246,0.22)] active:scale-[0.98] touch-manipulation"
                  >
                    Leaderboard
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <footer className="mt-auto pb-2 pt-4 text-center text-[11px] text-white/35">
          Quick • Hidden Word
        </footer>
      </div>
    </main>
  );
}
