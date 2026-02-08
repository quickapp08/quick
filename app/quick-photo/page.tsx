"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/* ---------- UI atoms (design only) ---------- */

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

function StatusPill({
  phase,
}: {
  phase: "loading" | "countdown" | "submit" | "vote" | "ended";
}) {
  const tone =
    phase === "submit"
      ? "border-emerald-300/25 bg-emerald-500/12 text-emerald-50"
      : phase === "vote"
      ? "border-blue-300/22 bg-blue-500/12 text-blue-50"
      : phase === "ended"
      ? "border-white/12 bg-white/6 text-white/85"
      : "border-white/12 bg-white/6 text-white/85";

  const icon =
    phase === "submit"
      ? "🟢"
      : phase === "vote"
      ? "🗳️"
      : phase === "ended"
      ? "🏁"
      : phase === "countdown"
      ? "⏳"
      : "⚡";

  const label =
    phase === "submit"
      ? "SUBMIT"
      : phase === "vote"
      ? "VOTE"
      : phase === "ended"
      ? "ENDED"
      : phase === "countdown"
      ? "STARTING"
      : "LOADING";

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

function MiniPill({
  icon,
  children,
}: {
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-extrabold text-white/90">
      <span className="text-[13px] leading-none">{icon}</span>
      <span>{children}</span>
    </div>
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
          <span className="text-[18px] leading-none">→</span>
        </div>
      </div>
    </button>
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
  const [phase, setPhase] = useState<
    "loading" | "countdown" | "submit" | "vote" | "ended"
  >("loading");

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
        .select(
          "id, round_id, user_id, image_path, submitted_at, votes_up, votes_down, votes_total, status"
        )
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
      .select(
        "id, round_id, user_id, image_path, submitted_at, votes_up, votes_down, votes_total, status"
      )
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

      const { error: upErr } = await supabase.storage
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
        .select(
          "id, round_id, user_id, image_path, submitted_at, votes_up, votes_down, votes_total, status"
        )
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

    const { data, error } = await supabase.storage
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
        "relative min-h-[100svh] w-full text-white",
        "bg-gradient-to-b from-slate-950 via-slate-950 to-blue-950 overflow-x-hidden overscroll-x-none touch-pan-y"
      )}
      style={{
        paddingTop: "max(env(safe-area-inset-top), 18px)",
        paddingBottom: "max(env(safe-area-inset-bottom), 18px)",
      }}
    >
      {/* glow bg */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-24 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-blue-500/12 blur-[70px]" />
        <div className="absolute top-[240px] left-[-140px] h-[420px] w-[420px] rounded-full bg-blue-500/10 blur-[70px]" />
        <div className="absolute bottom-[-180px] right-[-180px] h-[520px] w-[520px] rounded-full bg-blue-500/10 blur-[80px]" />
      </div>

      <div className="relative mx-auto flex min-h-[100svh] max-w-md flex-col px-4">
        <header className="pt-2">
          <TopBar title="Photo Quick" />

          <div className="mt-5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-white/65">
                Game mode
              </div>
              <h1 className="mt-1 text-[28px] font-extrabold tracking-tight text-white/95 leading-tight">
                Photo Quick
              </h1>
              <div className="mt-2 text-[12px] text-white/55">
                Find it. Snap it. Send it.
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {round ? (
                  <MiniPill icon="⏱">
                    {phase === "submit"
                      ? `Submit: ${fmtMMSS(submitLeftMs)}`
                      : phase === "vote"
                      ? `Vote: ${fmtMMSS(voteLeftMs)}`
                      : phase === "ended"
                      ? "Ended"
                      : phase === "countdown"
                      ? "Starting"
                      : "Loading"}
                  </MiniPill>
                ) : (
                  <MiniPill icon="⏱">Loading</MiniPill>
                )}

                <MiniPill icon="📷">Camera-only</MiniPill>
              </div>
            </div>

            <div className="shrink-0">
              <StatusPill phase={phase} />
            </div>
          </div>

          <p className="mt-4 text-[13px] leading-relaxed text-white/70">
            Only real photos taken in-app. Inappropriate content will be punished
            and removed.
          </p>
        </header>

        {/* add padding so sticky CTA never hides content */}
        <section className="mt-5 space-y-3 pb-28">
          {/* Round */}
          <Card>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-[12px] font-semibold text-white/80">
                  Current round
                </div>
                <div className="text-[11px] text-white/45">
                  {round ? "Live timeline" : "Fetching"}
                </div>
              </div>

              {!round ? (
                <div className="mt-3 text-[13px] text-white/70">
                  {msg ?? "Loading..."}
                </div>
              ) : phase === "countdown" ? (
                <div className="mt-3">
                  <div className="text-[12px] text-white/65">Starting soon</div>
                  <div className="mt-2 text-[44px] font-extrabold tracking-tight">
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
                      <div className="mt-2 text-[52px] font-extrabold tracking-tight">
                        {preCountdownSec}
                      </div>
                      <div className="mt-2 text-[12px] text-white/55">
                        Prompt will appear when countdown ends.
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-[12px] text-white/65">Prompt</div>
                      <div className="mt-2 text-[40px] font-extrabold tracking-tight leading-tight">
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
                  <div className="mt-2 text-[22px] font-extrabold tracking-tight">
                    {round.prompt_text}
                  </div>
                  <div className="mt-2 text-[12px] text-white/55">
                    Vote if the photo matches the prompt and looks real (not
                    downloaded / screenshot).
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-[13px] text-white/70">
                  Round ended. Next round will start on the next hour.
                </div>
              )}
            </div>
          </Card>

          {/* Submit */}
          <Card>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-[12px] font-semibold text-white/80">
                  Submit
                </div>
                <div className="text-[11px] text-white/45">
                  One per round • No gallery
                </div>
              </div>

              <div className="mt-2 text-[12px] text-white/60">
                Camera-only. No gallery uploads. One submission per round.
              </div>

              {!userId ? (
                <div className="mt-3 rounded-3xl border border-white/10 bg-slate-950/35 p-4 shadow-[0_16px_48px_rgba(0,0,0,0.42)] backdrop-blur-[12px]">
                  <div className="text-[12px] text-white/60">
                    Login required for Photo Quick.
                  </div>

                  <div className="mt-3">
                    <PrimaryCTA
                      title="Go to Login"
                      subtitle="Sign in to submit and vote"
                      onClick={() => router.push("/auth")}
                    />
                  </div>
                </div>
              ) : mySubmission ? (
                <div className="mt-3 rounded-3xl border border-white/10 bg-slate-950/35 p-4 shadow-[0_16px_48px_rgba(0,0,0,0.42)] backdrop-blur-[12px]">
                  <div className="text-[12px] text-white/60">
                    ✅ Submitted. Status:{" "}
                    <span className="font-semibold text-white/80">
                      {mySubmission.status}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-center">
                      <div className="text-[10px] text-white/45">Up</div>
                      <div className="text-[14px] font-extrabold text-white/90">
                        {mySubmission.votes_up} 👍
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-center">
                      <div className="text-[10px] text-white/45">Down</div>
                      <div className="text-[14px] font-extrabold text-white/90">
                        {mySubmission.votes_down} 👎
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-center">
                      <div className="text-[10px] text-white/45">Total</div>
                      <div className="text-[14px] font-extrabold text-white/90">
                        {mySubmission.votes_total}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    className={cx(
                      "mt-3 rounded-3xl border border-dashed p-4",
                      "shadow-[0_16px_48px_rgba(0,0,0,0.42)] backdrop-blur-[12px]",
                      promptVisible
                        ? "border-blue-300/20 bg-blue-500/8"
                        : "border-white/12 bg-slate-950/35"
                    )}
                  >
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
                      className={cx(
                        "mt-3 w-full rounded-2xl border px-3 py-3 text-[12px] outline-none",
                        "border-white/10 bg-slate-950/35 text-white placeholder:text-white/35",
                        "shadow-[0_14px_40px_rgba(0,0,0,0.35)] backdrop-blur-[10px]",
                        "focus:border-blue-300/25 focus:ring-2 focus:ring-blue-400/50"
                      )}
                      disabled={!promptVisible || submitting}
                      onChange={(e) =>
                        onPickFile(e.target.files?.[0] ?? null)
                      }
                    />

                    {previewUrl && (
                      <div className="mt-3 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/30">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={previewUrl}
                          alt="preview"
                          className="w-full"
                        />
                      </div>
                    )}
                  </div>

                  <button
                    onClick={submitPhoto}
                    disabled={!promptVisible || submitting || !photoFile}
                    className={cx(
                      "mt-3 group relative w-full overflow-hidden rounded-3xl border px-5 py-5 text-left",
                      "shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-[12px] transition",
                      "active:scale-[0.98] touch-manipulation",
                      (!promptVisible || submitting || !photoFile)
                        ? "border-white/10 bg-white/5 text-white/40"
                        : "border-blue-300/22 bg-gradient-to-b from-blue-500/28 to-blue-500/12 hover:-translate-y-[1px] hover:shadow-[0_0_70px_rgba(59,130,246,0.25)]"
                    )}
                  >
                    {!(!promptVisible || submitting || !photoFile) ? (
                      <>
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
                      </>
                    ) : null}

                    <div className="relative z-[2] flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-[18px] font-extrabold tracking-tight text-white/95">
                          {submitting ? "Submitting..." : "Submit Photo"}
                        </div>
                        <div className="mt-1 text-[12px] text-white/65">
                          {promptVisible
                            ? `Time left: ${fmtMMSS(submitLeftMs)}`
                            : "Locked until prompt reveal"}
                        </div>
                      </div>

                      <div className="grid h-12 w-12 place-items-center rounded-2xl border border-blue-300/18 bg-blue-500/12">
                        <span className="text-[18px] leading-none">▶</span>
                      </div>
                    </div>
                  </button>
                </>
              )}
            </div>
          </Card>

          {/* Voting */}
          <Card>
            <div className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-white/80">
                    Voting
                  </div>
                  <div className="mt-1 text-[12px] text-white/55">
                    Vote based on realism. No screenshots, no downloads.
                  </div>
                </div>

                <button
                  onClick={loadVoteList}
                  disabled={phase !== "vote" || loadingVotes || !userId}
                  className={cx(
                    "shrink-0 rounded-2xl border px-3 py-2 text-[12px] font-extrabold transition",
                    "shadow-[0_14px_40px_rgba(0,0,0,0.35)] backdrop-blur-[10px] active:scale-[0.98] touch-manipulation",
                    phase !== "vote" || !userId
                      ? "border-white/10 bg-white/5 text-white/40"
                      : "border-white/12 bg-white/6 text-white/80 hover:bg-white/10"
                  )}
                >
                  {loadingVotes ? "Refreshing..." : "Refresh"}
                </button>
              </div>

              {phase !== "vote" ? (
                <div className="mt-3 text-[12px] text-white/55">
                  Voting starts after the 30-minute submit window ends.
                </div>
              ) : !userId ? (
                <div className="mt-3 text-[12px] text-white/55">
                  Login required to vote.
                </div>
              ) : voteList.length === 0 ? (
                <div className="mt-3 text-[12px] text-white/55">
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
          </Card>

          {msg && (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-3 text-[12px] text-white/70 shadow-[0_16px_48px_rgba(0,0,0,0.42)] backdrop-blur-[12px]">
              {msg}
            </div>
          )}
        </section>

        <footer className="mt-auto pb-2 pt-6 text-center text-[11px] text-white/35">
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
    <div
      className={cx(
        "relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950/35 p-3",
        "shadow-[0_16px_48px_rgba(0,0,0,0.42)] backdrop-blur-[12px]"
      )}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-blue-500/10 blur-2xl"
        aria-hidden="true"
      />

      <div className="relative z-[2]">
        <div className="flex items-center justify-between">
          <div className="text-[11px] text-white/45">
            Votes: {s.votes_up} 👍 / {s.votes_down} 👎 (total {s.votes_total})
          </div>
          <div className="text-[11px] text-white/45">Community check</div>
        </div>

        <div className="mt-2 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/30">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="submission" className="w-full" />
          ) : (
            <div className="p-6 text-center text-[12px] text-white/50">
              Loading...
            </div>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => onVote(s.id, 1)}
            className={cx(
              "rounded-3xl border px-4 py-3 text-[13px] font-extrabold transition",
              "shadow-[0_14px_40px_rgba(0,0,0,0.35)] backdrop-blur-[10px] active:scale-[0.98] touch-manipulation",
              "border-emerald-300/25 bg-emerald-500/10 text-white/90 hover:bg-emerald-500/14"
            )}
          >
            👍 Legit
          </button>
          <button
            onClick={() => onVote(s.id, -1)}
            className={cx(
              "rounded-3xl border px-4 py-3 text-[13px] font-extrabold transition",
              "shadow-[0_14px_40px_rgba(0,0,0,0.35)] backdrop-blur-[10px] active:scale-[0.98] touch-manipulation",
              "border-rose-300/25 bg-rose-500/10 text-white/90 hover:bg-rose-500/14"
            )}
          >
            👎 Fake
          </button>
        </div>

        <div className="mt-2 text-[11px] text-white/45">
          Vote based on realism: no screenshots, no downloads.
        </div>
      </div>
    </div>
  );
}
