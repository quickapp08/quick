"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function TopBar({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between">
      <Link
        href="/settings"
        className="rounded-xl border border-white/12 bg-white/6 px-3 py-2 text-[13px] text-white/80 transition hover:bg-white/10 active:scale-[0.98] touch-manipulation"
      >
        ← Back
      </Link>
      <div className="text-[13px] font-semibold text-white/85">{title}</div>
      <div className="w-[64px]" />
    </div>
  );
}

type Profile = {
  user_id: string;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  points_total: number | null;
  username_changed_at: string | null;
};

function getRank(points: number) {
  if (points >= 1000) return "Godlike";
  if (points >= 500) return "Flash";
  if (points >= 200) return "No Joke";
  if (points >= 100) return "Speedy";
  if (points >= 50) return "Turtle";
  if (points >= 10) return "Snail";
  return "Rookie";
}

function rankTone(rank: string) {
  if (rank === "Godlike") return "border-yellow-300/25 bg-yellow-500/10 text-yellow-100";
  if (rank === "Flash") return "border-emerald-300/25 bg-emerald-500/10 text-emerald-100";
  if (rank === "No Joke") return "border-blue-300/25 bg-blue-500/10 text-blue-100";
  if (rank === "Speedy") return "border-cyan-300/25 bg-cyan-500/10 text-cyan-100";
  return "border-white/12 bg-white/6 text-white/80";
}

/** ✅ 8 predefiniranih avatara (local) */
const AVATARS: Array<{ id: number; src: string }> = Array.from({ length: 8 }).map((_, idx) => {
  const n = String(idx + 1).padStart(2, "0");
  return { id: idx + 1, src: `/avatars/a${n}.webp` };
});

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pointsTotal = Number(profile?.points_total ?? 0);
  const rank = useMemo(() => getRank(pointsTotal), [pointsTotal]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setMsg(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        setMsg("Moraš biti ulogiran da uređuješ profil.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, username, bio, avatar_url, points_total, username_changed_at")
        .eq("user_id", user.id)
        .single();

      if (error) {
        setMsg(error.message);
        setLoading(false);
        return;
      }

      const p = data as Profile;
      setProfile(p);
      setUsername(p.username ?? "");
      setBio(p.bio ?? "");
      setAvatarUrl(p.avatar_url ?? "");
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    setMsg(null);

    const u = username.trim();
    const a = avatarUrl.trim();

    const { data, error } = await supabase.rpc("update_profile", {
      p_username: u ? u : null,
      p_bio: bio ?? null,
      p_avatar_url: a ? a : null,
    });

    if (error) {
      setMsg(error.message);
      setSaving(false);
      return;
    }

    if (!data?.ok) {
      setMsg(`Error: ${data?.error ?? "unknown_error"}`);
      setSaving(false);
      return;
    }

    // refresh
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (user) {
      const { data: fresh } = await supabase
        .from("profiles")
        .select("user_id, username, bio, avatar_url, points_total, username_changed_at")
        .eq("user_id", user.id)
        .single();
      if (fresh) setProfile(fresh as Profile);
    }

    setMsg("Spremljeno ✅");
    setSaving(false);
  };

  const avatarPreview = (avatarUrl || profile?.avatar_url || "").trim();

  const selectedAvatarIsPreset = useMemo(() => {
    const a = avatarPreview;
    return !!a && AVATARS.some((x) => x.src === a);
  }, [avatarPreview]);

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
          <TopBar title="Profile" />
          <div className="mt-4">
            <h1 className="text-[22px] font-bold tracking-tight">Profile</h1>
            <p className="mt-1 text-[12px] leading-relaxed text-white/60">
              Nickname, bio i avatar se prikazuju na leaderboardu.
            </p>
          </div>
        </header>

        <section className="mt-4 space-y-3">
          {/* HERO STATUS CARD */}
          <div
            className={cx(
              "rounded-3xl border border-blue-300/20",
              "bg-gradient-to-b from-blue-500/16 to-white/5",
              "p-4"
            )}
          >
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-white/12 bg-white/6">
                {avatarPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarPreview}
                    alt="Avatar"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center text-[18px] text-white/70">
                    👤
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[12px] text-white/65">Status</div>
                <div className="mt-0.5 truncate text-[15px] font-semibold text-white/92">
                  {loading ? "Loading…" : profile?.username || "No nickname yet"}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className={cx(
                      "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold",
                      rankTone(rank)
                    )}
                  >
                    {loading ? "Rank…" : rank}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[11px] font-semibold text-white/85">
                    {loading ? "Points…" : `${pointsTotal} pts`}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[11px] text-white/55">
              {profile?.username_changed_at ? (
                <>
                  Username last changed:{" "}
                  <span className="text-white/75">
                    {new Date(profile.username_changed_at).toLocaleString()}
                  </span>
                </>
              ) : (
                <>Username change time not set (OK).</>
              )}
            </div>
          </div>

          {/* AVATAR PICKER CARD (8 avatars) */}
          <div className="rounded-3xl border border-white/12 bg-white/6 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[13px] font-semibold text-white/90">Choose avatar</div>
                <div className="mt-0.5 text-[11px] text-white/55">
                  8 presets • stored as avatar_url.
                </div>
              </div>
              <div
                className={cx(
                  "rounded-full border px-3 py-1 text-[11px] font-semibold",
                  selectedAvatarIsPreset
                    ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
                    : "border-white/12 bg-white/6 text-white/70"
                )}
              >
                {selectedAvatarIsPreset ? "Selected" : "Custom / none"}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2">
              {AVATARS.map((a) => {
                const active = avatarPreview === a.src;
                return (
                  <button
                    key={a.id}
                    type="button"
                    disabled={loading || saving}
                    onClick={() => setAvatarUrl(a.src)}
                    className={cx(
                      "relative aspect-square w-full overflow-hidden rounded-2xl border transition active:scale-[0.98] touch-manipulation",
                      active
                        ? "border-blue-300/30 bg-blue-500/12 shadow-[0_0_35px_rgba(59,130,246,0.20)]"
                        : "border-white/10 bg-white/5 hover:bg-white/8"
                    )}
                    aria-label={`Select avatar ${a.id}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.src} alt="" className="h-full w-full object-cover" />
                    {active ? (
                      <span className="absolute bottom-1 right-1 grid h-5 w-5 place-items-center rounded-full border border-white/15 bg-blue-500/20 text-[11px] font-extrabold">
                        ✓
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 text-[11px] text-white/45">
              Putanja: <span className="text-white/70">/public/avatars/a01.webp → /avatars/a01.webp</span>
            </div>
          </div>

          {/* FORM CARD */}
          <div className="rounded-3xl border border-white/12 bg-white/6 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-semibold text-white/90">Edit profile</div>
                <div className="mt-0.5 text-[11px] text-white/55">
                  Keep it short and clean for the leaderboard.
                </div>
              </div>
              <div className="rounded-full border border-white/12 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/70">
                Public
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block">
                <div className="mb-1 text-[12px] font-medium text-white/70">Nickname</div>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="npr. Nirus"
                  disabled={loading || saving}
                  className={cx(
                    "w-full rounded-2xl border px-4 py-3 text-[15px] outline-none",
                    "border-white/12 bg-black/20 text-white placeholder:text-white/35",
                    "focus:border-white/25 focus:bg-black/30 focus:ring-2 focus:ring-blue-400/40"
                  )}
                />
              </label>

              <label className="block">
                <div className="mb-1 text-[12px] font-medium text-white/70">Bio</div>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="kratko o sebi…"
                  disabled={loading || saving}
                  rows={3}
                  className={cx(
                    "w-full resize-none rounded-2xl border px-4 py-3 text-[15px] outline-none",
                    "border-white/12 bg-black/20 text-white placeholder:text-white/35",
                    "focus:border-white/25 focus:bg-black/30 focus:ring-2 focus:ring-blue-400/40"
                  )}
                />
                <div className="mt-1 text-[11px] text-white/45">Tip: 1–2 rečenice je najbolje.</div>
              </label>

              {/* Advanced (optional) - i dalje možeš upisat custom url */}
              <details className="rounded-2xl border border-white/10 bg-white/4 px-4 py-3">
                <summary className="cursor-pointer list-none">
                  <div className="flex items-center justify-between">
                    <div className="text-[12px] font-semibold text-white/75">Advanced</div>
                    <div className="text-white/40">▾</div>
                  </div>
                </summary>

                <div className="mt-3">
                  <div className="mb-1 text-[12px] font-medium text-white/70">Avatar URL</div>
                  <input
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://… ili /avatars/a01.webp"
                    disabled={loading || saving}
                    className={cx(
                      "w-full rounded-2xl border px-4 py-3 text-[15px] outline-none",
                      "border-white/12 bg-black/20 text-white placeholder:text-white/35",
                      "focus:border-white/25 focus:bg-black/30 focus:ring-2 focus:ring-blue-400/40"
                    )}
                  />
                  <div className="mt-1 text-[11px] text-white/45">Best: square (1:1).</div>
                </div>
              </details>
            </div>

            <button
              onClick={save}
              disabled={loading || saving}
              className={cx(
                "mt-4 w-full rounded-2xl border px-5 py-4 text-left transition active:scale-[0.98] touch-manipulation",
                !loading && !saving
                  ? "border-blue-300/25 bg-gradient-to-b from-blue-500/25 to-blue-500/10 hover:-translate-y-[1px] hover:shadow-[0_0_40px_rgba(59,130,246,0.28)]"
                  : "border-white/10 bg-white/5 opacity-50"
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[16px] font-semibold">{saving ? "Saving…" : "Save Profile"}</div>
                  <div className="mt-1 text-[12px] text-white/65">Update nickname, bio, avatar</div>
                </div>
                <div className="text-white/55">→</div>
              </div>
            </button>

            {msg ? (
              <div
                className={cx(
                  "mt-3 rounded-2xl border px-4 py-3 text-[13px]",
                  msg.includes("✅")
                    ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
                    : "border-rose-300/20 bg-rose-500/10 text-rose-100"
                )}
              >
                {msg}
              </div>
            ) : null}
          </div>
        </section>

        <footer className="mt-auto pb-2 pt-6 text-center text-[11px] text-white/35">
          Quick • Profile
        </footer>
      </div>
    </main>
  );
}
