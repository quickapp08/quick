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
          <h1 className="mt-5 text-2xl font-bold tracking-tight">Profile</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-white/70">
            Nickname i bio se prikazuju na leaderboardu.
          </p>
        </header>

        <section className="mt-5 space-y-3">
          <div className="rounded-2xl border border-white/12 bg-white/6 p-4">
            <div className="text-[12px] text-white/70">Status</div>
            <div className="mt-1 text-[14px] font-semibold">
              {loading ? "Loading…" : `Rank: ${rank} • Points: ${pointsTotal}`}
            </div>
            {profile?.username_changed_at ? (
              <div className="mt-2 text-[11px] text-white/45">
                Username last changed: {new Date(profile.username_changed_at).toLocaleString()}
              </div>
            ) : (
              <div className="mt-2 text-[11px] text-white/45">
                Username change time not set (OK).
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/12 bg-white/6 p-4">
            <label className="block">
              <div className="mb-1 text-[12px] font-medium text-white/70">Nickname</div>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="npr. Nirus"
                disabled={loading || saving}
                className="w-full rounded-2xl border border-white/12 bg-black/20 px-4 py-3 text-[15px] text-white placeholder:text-white/35 outline-none focus:border-white/25 focus:bg-black/30"
              />
            </label>

            <label className="mt-4 block">
              <div className="mb-1 text-[12px] font-medium text-white/70">Bio</div>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="kratko o sebi…"
                disabled={loading || saving}
                rows={3}
                className="w-full resize-none rounded-2xl border border-white/12 bg-black/20 px-4 py-3 text-[15px] text-white placeholder:text-white/35 outline-none focus:border-white/25 focus:bg-black/30"
              />
            </label>

            <label className="mt-4 block">
              <div className="mb-1 text-[12px] font-medium text-white/70">Avatar URL</div>
              <input
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://…"
                disabled={loading || saving}
                className="w-full rounded-2xl border border-white/12 bg-black/20 px-4 py-3 text-[15px] text-white placeholder:text-white/35 outline-none focus:border-white/25 focus:bg-black/30"
              />
            </label>

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
              <div className="text-[16px] font-semibold">{saving ? "Saving…" : "Save Profile"}</div>
              <div className="mt-1 text-[12px] text-white/65">Update nickname, bio, avatar</div>
            </button>

            {msg ? (
              <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[13px] text-white/80">
                {msg}
              </div>
            ) : null}
          </div>
        </section>

        <footer className="mt-auto pb-2 pt-8 text-center text-[11px] text-white/40">
          Quick • Profile
        </footer>
      </div>
    </main>
  );
}
