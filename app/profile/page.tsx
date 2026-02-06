"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { getRank } from "../../lib/rank";

type Profile = {
  user_id: string;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  points_total: number;
  username_changed_at: string | null;
};

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string>("");

  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const rank = useMemo(() => getRank(profile?.points_total ?? 0), [profile?.points_total]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setMsg(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        setLoading(false);
        setMsg("You must be logged in.");
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

      setProfile(data as Profile);
      setUsername((data as Profile).username ?? "");
      setBio((data as Profile).bio ?? "");
      setAvatarUrl((data as Profile).avatar_url ?? "");
      setLoading(false);
    })();
  }, []);

  const saveProfile = async () => {
    setSaving(true);
    setMsg(null);

    const { data, error } = await supabase.rpc("update_profile", {
      p_username: username.trim() ? username.trim() : null,
      p_bio: bio ?? null,
      p_avatar_url: avatarUrl.trim() ? avatarUrl.trim() : null,
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

    // refresh profile
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

    setMsg("Saved ✅");
    setSaving(false);
  };

  return (
    <main
      className="min-h-[100svh] w-full bg-gradient-to-b from-slate-950 via-slate-950 to-blue-950 text-white"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 18px)",
        paddingBottom: "max(env(safe-area-inset-bottom), 18px)",
      }}
    >
      <div className="mx-auto flex min-h-[100svh] max-w-md flex-col px-4">
        <header className="pt-2">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="rounded-xl border border-white/12 bg-white/6 px-3 py-2 text-[13px] text-white/80 transition hover:bg-white/10 active:scale-[0.98]"
            >
              ← Back
            </Link>
            <div className="text-[13px] font-semibold text-white/85">Profile</div>
            <div className="w-[64px]" />
          </div>

          <h1 className="mt-5 text-2xl font-bold tracking-tight">Your Profile</h1>
          <p className="mt-2 text-[13px] text-white/70">Rank, username, avatar and bio.</p>
        </header>

        {loading ? (
          <div className="mt-6 rounded-2xl border border-white/12 bg-white/6 p-4 text-white/70">
            Loading...
          </div>
        ) : profile ? (
          <section className="mt-6 space-y-3">
            <div className="rounded-2xl border border-blue-300/20 bg-blue-500/10 p-4">
              <div className="text-[12px] text-white/70">Total points</div>
              <div className="mt-1 text-[22px] font-extrabold">{profile.points_total}</div>
              <div className="mt-2 text-[12px] text-white/70">Rank</div>
              <div className="mt-1 text-[16px] font-semibold">{rank}</div>
            </div>

            <div className="rounded-2xl border border-white/12 bg-white/6 p-4">
              <div className="text-[12px] font-semibold text-white/85">Username</div>
              <div className="mt-1 text-[11px] text-white/55">
                Can be changed once every 5 days.
              </div>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Your name"
                className="mt-3 w-full rounded-xl border border-white/12 bg-slate-950/40 px-4 py-3 text-[15px] outline-none"
              />
            </div>

            <div className="rounded-2xl border border-white/12 bg-white/6 p-4">
              <div className="text-[12px] font-semibold text-white/85">Avatar URL</div>
              <div className="mt-1 text-[11px] text-white/55">
                For now: paste image URL. Next: upload to Supabase Storage.
              </div>
              <input
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
                className="mt-3 w-full rounded-xl border border-white/12 bg-slate-950/40 px-4 py-3 text-[15px] outline-none"
              />
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="avatar"
                  className="mt-3 h-20 w-20 rounded-2xl border border-white/12 object-cover"
                />
              ) : null}
            </div>

            <div className="rounded-2xl border border-white/12 bg-white/6 p-4">
              <div className="text-[12px] font-semibold text-white/85">Bio</div>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Write something about you..."
                className="mt-3 w-full resize-none rounded-xl border border-white/12 bg-slate-950/40 px-4 py-3 text-[15px] outline-none"
                rows={4}
              />
            </div>

            <button
              onClick={saveProfile}
              disabled={saving}
              className="w-full rounded-2xl border border-blue-300/25 bg-gradient-to-b from-blue-500/25 to-blue-500/10 px-5 py-4 text-left transition hover:-translate-y-[1px] hover:shadow-[0_0_40px_rgba(59,130,246,0.28)] active:scale-[0.98] disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[16px] font-semibold">{saving ? "Saving..." : "Save changes"}</div>
                  <div className="mt-1 text-[12px] text-white/65">Server enforces 5-day username cooldown</div>
                </div>
                <div className="text-white/55">→</div>
              </div>
            </button>

            {msg ? (
              <div className="rounded-2xl border border-white/12 bg-white/6 p-4 text-[13px] text-white/75">
                {msg}
              </div>
            ) : null}
          </section>
        ) : (
          <div className="mt-6 rounded-2xl border border-white/12 bg-white/6 p-4 text-white/70">
            {msg ?? "No profile found."}
          </div>
        )}

        <footer className="mt-auto pb-2 pt-8 text-center text-[11px] text-white/40">
          Quick • Profile
        </footer>
      </div>
    </main>
  );
}
