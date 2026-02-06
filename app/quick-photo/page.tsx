"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

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

type Round = {
  id: string;
  starts_at: string;
  submit_ends_at: string;
  vote_ends_at: string;
  prompt_text: string;
};

type Submission = {
  id: string;
  round_id: string;
  user_id: string;
  image_path: string;
  submitted_at: string;
  votes_up: number;
  votes_down: number;
  votes_total: number;
  status: "pending" | "verified" | "rejected";
};

function msLeft(toIso: string) {
  const ms = new Date(toIso).getTime() - Date.now();
  return Math.max(0, ms);
}

function fmtMMSS(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function QuickPhotoPage() {
  const router = useRouter();

  // ---- UI countdown (before reveal) ----
  const [preCountdownSec, setPreCountdownSec] = useState<number>(10);
  const [preCountdownDone, setPreCountdownDone] = useState<boolean>(false);

  // ---- round / phase ----
  const [round, setRound] = useState<Round | null>(null);
  const [phase, setPhase] = useState<"loading" | "countdown" | "submit" | "vote" | "ended">("loading");

  // ---- timers ----
  const [submitLeftMs, setSubmitLeftMs] = useState<number>(0);
  const [voteLeftMs, setVoteLeftMs] = useState<number>(0);

  // ---- auth ----
  const [userId, setUserId] = useState<string | null>(null);

  // ---- camera-only capture ----
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // ---- submission ----
  const [mySubmission, setMySubmission] = useState<Submission | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // ---- voting list (simple MVP) ----
  const [voteList, setVoteList] = useState<Submission[]>([]);
  const [loadingVotes, setLoadingVotes] = useState(false);

  // -----------------------------
  // 1) Get auth user
  // -----------------------------
  useEffect(() => {
    let alive = true;

    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!alive) return;
      setUserId(data.user?.id ?? null);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // -----------------------------
  // 2) Load current round
  //    (latest round that hasn't ended)
  // -----------------------------
  useEffect(() => {
    let alive = true;

    async function loadRound() {
      setMsg(null);
      setPhase("loading");

      const { data, error } = await supabase
        .from("photo_rounds")
        .select("id, starts_at, submit_ends_at, vote_ends_at, prompt_text")
        .gt("vote_ends_at", new Date().toISOString())
        .order("starts_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!alive) return;

      if (error) {
        setMsg(error.message);
        setRound(null);
        setPhase("loading");
        return;
      }

      if (!data) {
        setMsg("No active round yet. Please come back soon.");
        setRound(null);
        setPhase("loading");
        return;
      }

      setRound(data as Round);

      // reset reveal countdown whenever round changes
      setPreCountdownSec(10);
      setPreCountdownDone(false);
    }

    loadRound();

    // refresh round periodically (mobile users keep app open)
    const t = setInterval(loadRound, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  // -----------------------------
  // 3) Phase machine + timers
  // -----------------------------
  useEffect(() => {
    if (!round) return;

    const tick = () => {
      const now = Date.now();
      const start = new Date(round.starts_at).getTime();
      const submitEnd = new Date(round.submit_ends_at).getTime();
      const voteEnd = new Date(round.vote_ends_at).getTime();

      // If round hasn't started yet, we are in countdown
      if (now < start) {
        setPhase("countdown");
        setSubmitLeftMs(submitEnd - start); // not used yet
        setVoteLeftMs(voteEnd - submitEnd); // not used yet
        return;
      }

      // Round has started: we do our local pre-countdown reveal (10s)
      // while still in submit phase, to hide prompt until countdown ends
      if (now >= start && now < submitEnd) {
        setPhase("submit");
        setSubmitLeftMs(Math.max(0, submitEnd - now));
        setVoteLeftMs(Math.max(0, voteEnd - now));
        return;
      }

      if (now >= submitEnd && now < voteEnd) {
        setPhase("vote");
        setSubmitLeftMs(0);
        setVoteLeftMs(Math.max(0, voteEnd - now));
        return;
      }

      setPhase("ended");
      setSubmitLeftMs(0);
      setVoteLeftMs(0);
    };

    tick();
    const i = setInterval(tick, 250);

    return () => clearInterval(i);
  }, [round]);

  // -----------------------------
  // 4) Local 10s reveal countdown
  //    IMPORTANT: prompt hidden until done
  // -----------------------------
  useEffect(() => {
    if (!round) return;

    // only count down when we're in submit phase and not done yet
    if (phase !== "submit" || preCountdownDone) return;

    // Start the local 10s reveal countdown as soon as submit phase begins
    // If user opens app mid-round, we skip the reveal countdown (prompt is shown immediately),
    // because it's already "live".
    const start = new Date(round.starts_at).getTime();
    const now = Date.now();
    const secondsSinceStart = Math.floor((now - start) / 1000);

    if (secondsSinceStart >= 10) {
      setPreCountdownDone(true);
      setPreCountdownSec(0);
      return;
    }

    setPreCountdownSec(10 - secondsSinceStart);

    const t = setInterval(() => {
      const now2 = Date.now();
      const s2 = Math.floor((now2 - start) / 1000);
      const left = 10 - s2;
      if (left <= 0) {
        setPreCountdownSec(0);
        setPreCountdownDone(true);
        clearInterval(t);
      } else {
        setPreCountdownSec(left);
      }
    }, 250);

    return () => clearInterval(t);
  }, [round, phase, preCountdownDone]);

  // -----------------------------
  // 5) Load my submission (if logged in)
  // -----------------------------
  useEffect(() => {
    if (!round || !userId) {
      setMySubmission(null);
      return;
    }

    let alive = true;

    (async () => {
      const { data, error } = await supabase
        .from("photo_submissions")
        .select("id, round_id, user_id, image_path, submitted_at, votes_up, votes_down, votes_total, status")
        .eq("round_id", round.id)
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (!alive) return;
      if (error) return;

      setMySubmission((data as Submission) ?? null);
    })();

    return () => {
      alive = false;
    };
  }, [round, userId]);

  // -----------------------------
  // 6) Voting list loader
  // -----------------------------
  async function loadVoteList() {
    if (!round || !userId) return;
    setLoadingVotes(true);

    const { data, error } = await supabase
      .from("photo_submissions")
      .select("id, round_id, user_id, image_path, submitted_at, votes_up, votes_down, votes_total, status")
      .eq("round_id", round.id)
      .order("submitted_at", { ascending: true })
      .limit(50);

    setLoadingVotes(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    // hide my own submission from voting list
    const list = (data as Submission[]).filter((s) => s.user_id !== userId);
    setVoteList(list);
  }

  useEffect(() => {
    if (phase === "vote") loadVoteList();
    // refresh votes periodically
    const t = setInterval(() => {
      if (phase === "vote") loadVoteList();
    }, 5000);

    return () => clearInterval(t);
  }, [phase, round?.id, userId]);

  // -----------------------------
  // 7) Camera-only capture handler
  // -----------------------------
  function onPickFile(file: File | null) {
    setMsg(null);
    setPhotoFile(file);

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  // -----------------------------
  // 8) Submit flow (camera-only)
  // -----------------------------
  async function submitPhoto() {
    if (!round) return;

    if (!userId) {
      setMsg("You must be logged in to play Photo Quick.");
      return;
    }

    if (phase !== "submit") {
      setMsg("Submission is closed.");
      return;
    }

    if (!preCountdownDone) {
      setMsg("Wait for the prompt reveal.");
      return;
    }

    if (mySubmission) {
      setMsg("You already submitted for this round.");
      return;
    }

    if (!photoFile) {
      setMsg("Take a photo first.");
      return;
    }

    // must be within submit window
    if (msLeft(round.submit_ends_at) <= 0) {
      setMsg("Too late. Submission window closed.");
      return;
    }

    setSubmitting(true);
    setMsg(null);

    try {
      // 1) upload to storage (private bucket)
      const ext = photoFile.name.split(".").pop() || "jpg";
      const path = `round_${round.id}/${userId}_${Date.now()}.${ext}`;

      const { error: upErr } = await supabase
        .storage
        .from("photo_quick")
        .upload(path, photoFile, { upsert: false });

      if (upErr) throw new Error(upErr.message);

      // 2) insert submission row
      const { data: inserted, error: insErr } = await supabase
        .from("photo_submissions")
        .insert({
          round_id: round.id,
          user_id: userId,
          image_path: path,
          submitted_at: new Date().toISOString(),
        })
        .select("id, round_id, user_id, image_path, submitted_at, votes_up, votes_down, votes_total, status")
        .single();

      if (insErr) throw new Error(insErr.message);

      setMySubmission(inserted as Submission);
      setPhotoFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setMsg("Submitted. Wait for votes.");
    } catch (e: any) {
      setMsg(e?.message ?? "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  // -----------------------------
  // 9) Voting (simple)
  // -----------------------------
  async function castVote(submissionId: string, vote: 1 | -1) {
    if (!userId) {
      setMsg("Login required to vote.");
      return;
    }
    setMsg(null);

    const { error } = await supabase.from("photo_votes").insert({
      submission_id: submissionId,
      voter_id: userId,
      vote,
    });

    if (error) {
      // duplicate vote etc.
      setMsg(error.message);
      return;
    }

    // refresh list
    await loadVoteList();
  }

  // -----------------------------
  // Render helpers: signed url
  // -----------------------------
  const signedUrls = useMemo(() => new Map<string, string>(), []);

  async function getSignedUrl(path: string) {
    if (signedUrls.has(path)) return signedUrls.get(path)!;

    const { data, error } = await supabase
      .storage
      .from("photo_quick")
      .createSignedUrl(path, 60 * 10); // 10min

    if (error || !data?.signedUrl) return "";
    signedUrls.set(path, data.signedUrl);
    return data.signedUrl;
  }

  // prefetch signed urls for voting list
  useEffect(() => {
    if (phase !== "vote") return;
    (async () => {
      for (const s of voteList) await getSignedUrl(s.image_path);
    })();
  }, [phase, voteList]);

  const promptVisible = phase === "submit" && preCountdownDone;

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
          <TopBar title="Photo Quick" />

          <h1 className="mt-5 text-2xl font-bold tracking-tight">
            Find it. Snap it. Send it.
          </h1>

          <p className="mt-2 text-[13px] leading-relaxed text-white/70">
            Only real photos taken in-app. Inappropriate content will be punished and removed.
          </p>
        </header>

        {/* Round card */}
        <section className="mt-6 space-y-3">
          <div className="rounded-2xl border border-blue-300/20 bg-blue-500/10 p-5">
            <div className="flex items-center justify-between">
              <div className="text-[12px] text-white/70">Current round</div>
              {round && (
                <div className="text-[12px] text-white/60">
                  {phase === "submit" && `Submit: ${fmtMMSS(submitLeftMs)}`}
                  {phase === "vote" && `Vote: ${fmtMMSS(voteLeftMs)}`}
                  {phase === "ended" && "Ended"}
                </div>
              )}
            </div>

            {/* Prompt / Countdown display */}
            {!round ? (
              <div className="mt-3 text-[13px] text-white/70">
                {msg ?? "Loading..."}
              </div>
            ) : phase === "countdown" ? (
              <div className="mt-3">
                <div className="text-[12px] text-white/65">Starting soon</div>
                <div className="mt-2 text-4xl font-extrabold tracking-tight">
                  …
                </div>
                <div className="mt-2 text-[12px] text-white/55">
                  Wait for the round to start.
                </div>
              </div>
            ) : phase === "submit" ? (
              <div className="mt-3">
                {!preCountdownDone ? (
                  <>
                    <div className="text-[12px] text-white/65">Get ready</div>
                    <div className="mt-2 text-5xl font-extrabold tracking-tight">
                      {preCountdownSec}
                    </div>
                    <div className="mt-2 text-[12px] text-white/55">
                      Prompt will appear when countdown ends.
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-[12px] text-white/65">Prompt</div>
                    <div className="mt-2 text-4xl font-extrabold tracking-tight">
                      {round.prompt_text}
                    </div>
                    <div className="mt-2 text-[12px] text-white/55">
                      You have 30 minutes to submit a real photo.
                    </div>
                  </>
                )}
              </div>
            ) : phase === "vote" ? (
              <div className="mt-3">
                <div className="text-[12px] text-white/65">Voting</div>
                <div className="mt-2 text-2xl font-extrabold tracking-tight">
                  {round.prompt_text}
                </div>
                <div className="mt-2 text-[12px] text-white/55">
                  Vote if the photo matches the prompt and looks real (not downloaded / screenshot).
                </div>
              </div>
            ) : (
              <div className="mt-3 text-[13px] text-white/70">
                Round ended. Next round will start on the next hour.
              </div>
            )}
          </div>

          {/* SUBMIT BLOCK */}
          <div className="rounded-2xl border border-white/12 bg-white/6 p-4">
            <div className="text-[12px] text-white/70">Submit</div>
            <div className="mt-1 text-[13px] text-white/65">
              Camera-only. No gallery uploads. One submission per round.
            </div>

            {!userId ? (
              <div className="mt-3 rounded-2xl border border-white/12 bg-slate-950/30 p-4 text-[12px] text-white/60">
                Login required for Photo Quick.
                <div className="mt-2">
                  <button
                    onClick={() => router.push("/auth")}
                    className="w-full rounded-2xl border border-blue-300/25 bg-gradient-to-b from-blue-500/25 to-blue-500/10 px-5 py-3 text-[13px] font-semibold transition active:scale-[0.98]"
                  >
                    Go to Login
                  </button>
                </div>
              </div>
            ) : (
              <>
                {mySubmission ? (
                  <div className="mt-3 rounded-2xl border border-white/12 bg-slate-950/30 p-4 text-[12px] text-white/60">
                    ✅ Submitted. Status: <span className="font-semibold">{mySubmission.status}</span>
                    <div className="mt-1 text-white/50">
                      Votes: {mySubmission.votes_up} 👍 / {mySubmission.votes_down} 👎 (total {mySubmission.votes_total})
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mt-3 rounded-2xl border border-dashed border-white/15 bg-slate-950/30 p-4">
                      <div className="text-[12px] text-white/55">
                        {promptVisible
                          ? "Open camera and take a photo. Gallery upload is not allowed."
                          : "Wait for the prompt reveal to enable camera."}
                      </div>

                      {/* Camera-only input */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="mt-3 w-full text-[12px] text-white/70"
                        disabled={!promptVisible || submitting}
                        onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                      />

                      {previewUrl && (
                        <div className="mt-3 overflow-hidden rounded-2xl border border-white/10">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={previewUrl} alt="preview" className="w-full" />
                        </div>
                      )}
                    </div>

                    <button
                      onClick={submitPhoto}
                      disabled={!promptVisible || submitting || !photoFile}
                      className={cx(
                        "mt-3 w-full rounded-2xl border px-5 py-4 text-left transition active:scale-[0.98] touch-manipulation",
                        (!promptVisible || submitting || !photoFile)
                          ? "border-white/10 bg-white/5 text-white/40"
                          : "border-blue-300/25 bg-gradient-to-b from-blue-500/25 to-blue-500/10 hover:-translate-y-[1px] hover:shadow-[0_0_40px_rgba(59,130,246,0.28)]"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[16px] font-semibold">
                            {submitting ? "Submitting..." : "Submit Photo"}
                          </div>
                          <div className="mt-1 text-[12px] text-white/65">
                            {promptVisible
                              ? `Time left: ${fmtMMSS(submitLeftMs)}`
                              : "Locked until prompt reveal"}
                          </div>
                        </div>
                        <div className="text-white/55">→</div>
                      </div>
                    </button>
                  </>
                )}
              </>
            )}
          </div>

          {/* VOTING BLOCK */}
          <div className="rounded-2xl border border-white/12 bg-white/6 p-4">
            <div className="flex items-center justify-between">
              <div className="text-[12px] text-white/70">Voting</div>
              <button
                onClick={loadVoteList}
                disabled={phase !== "vote" || loadingVotes || !userId}
                className={cx(
                  "rounded-xl border px-3 py-2 text-[12px] transition active:scale-[0.98]",
                  phase !== "vote" || !userId
                    ? "border-white/10 bg-white/5 text-white/40"
                    : "border-white/12 bg-white/6 text-white/80 hover:bg-white/10"
                )}
              >
                {loadingVotes ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            {phase !== "vote" ? (
              <div className="mt-2 text-[12px] text-white/55">
                Voting starts after the 30-minute submit window ends.
              </div>
            ) : !userId ? (
              <div className="mt-2 text-[12px] text-white/55">
                Login required to vote.
              </div>
            ) : voteList.length === 0 ? (
              <div className="mt-2 text-[12px] text-white/55">
                No submissions yet (or only yours).
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {voteList.map((s) => (
                  <VoteCard
                    key={s.id}
                    s={s}
                    getSignedUrl={getSignedUrl}
                    onVote={castVote}
                  />
                ))}
              </div>
            )}
          </div>

          {msg && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-[12px] text-white/70">
              {msg}
            </div>
          )}
        </section>

        <footer className="mt-auto pb-2 pt-8 text-center text-[11px] text-white/40">
          Quick • Photo Quick
        </footer>
      </div>
    </main>
  );
}

function VoteCard({
  s,
  getSignedUrl,
  onVote,
}: {
  s: Submission;
  getSignedUrl: (path: string) => Promise<string>;
  onVote: (id: string, vote: 1 | -1) => Promise<void>;
}) {
  const [url, setUrl] = useState<string>("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const u = await getSignedUrl(s.image_path);
      if (!alive) return;
      setUrl(u);
    })();
    return () => {
      alive = false;
    };
  }, [s.image_path, getSignedUrl]);

  return (
    <div className="rounded-2xl border border-white/12 bg-slate-950/30 p-3">
      <div className="text-[11px] text-white/45">
        Votes: {s.votes_up} 👍 / {s.votes_down} 👎 (total {s.votes_total})
      </div>

      <div className="mt-2 overflow-hidden rounded-2xl border border-white/10">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="submission" className="w-full" />
        ) : (
          <div className="p-6 text-center text-[12px] text-white/50">Loading...</div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => onVote(s.id, 1)}
          className="rounded-2xl border border-emerald-300/25 bg-emerald-500/10 px-4 py-3 text-[13px] font-semibold text-white/85 transition active:scale-[0.98]"
        >
          👍 Legit
        </button>
        <button
          onClick={() => onVote(s.id, -1)}
          className="rounded-2xl border border-rose-300/25 bg-rose-500/10 px-4 py-3 text-[13px] font-semibold text-white/85 transition active:scale-[0.98]"
        >
          👎 Fake
        </button>
      </div>

      <div className="mt-2 text-[11px] text-white/45">
        Vote based on realism: no screenshots, no downloads.
      </div>
    </div>
  );
}
