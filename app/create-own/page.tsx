"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

type Mode = "word" | "photo";
type Tab = "rooms" | "create" | "join";

type MyRoom = {
  room_id: string;
  code: string;
  mode: Mode;
  target_points: number;
  created_at: string;
};

type RoomRow = {
  place: number;
  user_id: string;
  username: string; // MVP: "Player"
  points_total: number;
};

type MsgRow = {
  id: number;
  user_id: string;
  username: string; // MVP: "Player"
  message: string;
  created_at: string;
};

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

function Segmented({
  value,
  onChange,
  options,
  cols = 2,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string; icon: string }>;
  cols?: 2 | 3;
}) {
  return (
    <div className="rounded-3xl border border-white/12 bg-white/6 p-1">
      <div className={cx("grid gap-1", cols === 2 ? "grid-cols-2" : "grid-cols-3")}>
        {options.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              onClick={() => onChange(o.value)}
              className={cx(
                "relative overflow-hidden rounded-3xl px-3 py-3 text-left transition active:scale-[0.98] touch-manipulation",
                active
                  ? "border border-blue-300/25 bg-gradient-to-b from-blue-500/22 to-blue-500/10 shadow-[0_0_30px_rgba(59,130,246,0.18)]"
                  : "border border-transparent hover:bg-white/8"
              )}
            >
              {active ? (
                <>
                  <div
                    className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-blue-500/14 blur-2xl"
                    aria-hidden="true"
                  />
                  <div
                    className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-white/6"
                    aria-hidden="true"
                  />
                </>
              ) : null}

              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-2xl border border-white/12 bg-white/5 text-[16px]">
                  {o.icon}
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-white/95">{o.label}</div>
                  <div className={cx("text-[11px]", active ? "text-white/65" : "text-white/45")}>
                    {active ? "Selected" : "Tap to switch"}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Card({
  icon,
  title,
  subtitle,
  right,
  onClick,
  variant = "default",
}: {
  icon: string;
  title: string;
  subtitle?: string;
  right?: string;
  onClick?: () => void;
  variant?: "default" | "accent" | "danger";
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "w-full rounded-3xl border p-4 text-left transition active:scale-[0.99] touch-manipulation",
        variant === "accent"
          ? "border-blue-300/20 bg-blue-500/10 hover:border-blue-300/40 hover:shadow-[0_0_40px_rgba(59,130,246,0.22)]"
          : variant === "danger"
          ? "border-rose-300/20 bg-rose-500/10 hover:border-rose-300/35"
          : "border-white/12 bg-white/6 hover:bg-white/8"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cx("grid h-10 w-10 place-items-center rounded-2xl border text-[16px]",
            variant === "accent"
              ? "border-blue-300/25 bg-blue-500/12"
              : variant === "danger"
              ? "border-rose-300/25 bg-rose-500/12"
              : "border-white/12 bg-white/5"
          )}>
            {icon}
          </div>

          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold text-white/95">{title}</div>
            {subtitle ? <div className="mt-1 text-[11px] text-white/60">{subtitle}</div> : null}
          </div>
        </div>

        {right ? (
          <div className="shrink-0 rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[11px] text-white/75">
            {right}
          </div>
        ) : (
          <div className="text-white/45">→</div>
        )}
      </div>
    </button>
  );
}

export default function CreateOwnPage() {
  const [tab, setTab] = useState<Tab>("rooms");
  const [userId, setUserId] = useState<string | null>(null);

  // My rooms list
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsMsg, setRoomsMsg] = useState<string | null>(null);
  const [myRooms, setMyRooms] = useState<MyRoom[]>([]);

  // Active room detail
  const [activeRoom, setActiveRoom] = useState<MyRoom | null>(null);
  const [roomBoard, setRoomBoard] = useState<RoomRow[]>([]);
  const [roomMsgs, setRoomMsgs] = useState<MsgRow[]>([]);
  const [roomLoading, setRoomLoading] = useState(false);
  const [roomMsg, setRoomMsg] = useState<string | null>(null);

  // Create flow
  const [createMode, setCreateMode] = useState<Mode>("word");
  const [targetPoints, setTargetPoints] = useState<number>(1000);
  const [inviteText, setInviteText] = useState<string>("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createMsg, setCreateMsg] = useState<string | null>(null);

  // Join flow
  const [joinCode, setJoinCode] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinMsg, setJoinMsg] = useState<string | null>(null);

  // Chat input
  const [chatText, setChatText] = useState("");
  const [chatSending, setChatSending] = useState(false);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const headerTitle = useMemo(() => {
    if (activeRoom) return `Room • ${activeRoom.code}`;
    return "Rooms";
  }, [activeRoom]);

  const parseInviteEmails = (raw: string) => {
    return raw
      .split(/[,\n;]/g)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .filter((s) => s.includes("@") && s.includes("."));
  };

  const loadUser = async () => {
    const { data } = await supabase.auth.getUser();
    setUserId(data.user?.id ?? null);
  };

  const loadMyRooms = async () => {
    setRoomsLoading(true);
    setRoomsMsg(null);

    const { data, error } = await supabase.rpc("get_my_rooms", { p_limit: 3 });
    if (error) {
      setRoomsMsg(error.message);
      setMyRooms([]);
      setRoomsLoading(false);
      return;
    }

    setMyRooms((data ?? []) as MyRoom[]);
    setRoomsLoading(false);
  };

  const openRoom = async (room: MyRoom) => {
    setActiveRoom(room);
    setRoomLoading(true);
    setRoomMsg(null);

    const [lb, msgs] = await Promise.all([
      supabase.rpc("get_room_leaderboard", { p_room_id: room.room_id, p_limit: 100 }),
      supabase.rpc("get_room_messages", { p_room_id: room.room_id, p_limit: 50 }),
    ]);

    if (lb.error) {
      setRoomMsg(lb.error.message);
      setRoomBoard([]);
    } else {
      setRoomBoard((lb.data ?? []) as RoomRow[]);
    }

    if (msgs.error) {
      setRoomMsg(msgs.error.message);
      setRoomMsgs([]);
    } else {
      const ordered = ([...(msgs.data ?? [])] as MsgRow[]).reverse();
      setRoomMsgs(ordered);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }

    setRoomLoading(false);
  };

  const refreshActiveRoom = async () => {
    if (!activeRoom) return;
    const room = activeRoom;
    const [lb, msgs] = await Promise.all([
      supabase.rpc("get_room_leaderboard", { p_room_id: room.room_id, p_limit: 100 }),
      supabase.rpc("get_room_messages", { p_room_id: room.room_id, p_limit: 50 }),
    ]);

    if (!lb.error) setRoomBoard((lb.data ?? []) as RoomRow[]);
    if (!msgs.error) setRoomMsgs(([...(msgs.data ?? [])] as MsgRow[]).reverse());
  };

  const createRoom = async () => {
    setCreateLoading(true);
    setCreateMsg(null);

    const emails = parseInviteEmails(inviteText);

    const { data, error } = await supabase.rpc("create_room", {
      p_mode: createMode,
      p_target_points: targetPoints,
      p_invite_emails: emails,
    });

    if (error) {
      setCreateMsg(error.message);
      setCreateLoading(false);
      return;
    }

    const ok = (data as any)?.ok;
    if (!ok) {
      setCreateMsg((data as any)?.error ?? "Create failed");
      setCreateLoading(false);
      return;
    }

    await loadMyRooms();

    // auto open created room if it is in list now
    const createdCode = (data as any)?.code as string | undefined;
    const created = myRooms.find((r) => r.code === createdCode);
    if (created) {
      await openRoom(created);
    } else {
      // fallback: just go to rooms tab
      setTab("rooms");
    }

    setCreateLoading(false);
  };

  const joinRoom = async () => {
    setJoinLoading(true);
    setJoinMsg(null);

    const { data, error } = await supabase.rpc("join_room", { p_code: joinCode });

    if (error) {
      setJoinMsg(error.message);
      setJoinLoading(false);
      return;
    }

    const ok = (data as any)?.ok;
    if (!ok) {
      setJoinMsg((data as any)?.error ?? "Join failed");
      setJoinLoading(false);
      return;
    }

    await loadMyRooms();
    setTab("rooms");
    setJoinLoading(false);
  };

  const sendChat = async () => {
    if (!activeRoom) return;
    const msg = chatText.trim();
    if (!msg) return;

    setChatSending(true);
    const { data, error } = await supabase.rpc("send_room_message", {
      p_room_id: activeRoom.room_id,
      p_message: msg,
    });

    if (!error && (data as any)?.ok) {
      setChatText("");
      // realtime će dodat poruku, ali za MVP možemo refresh
      await refreshActiveRoom();
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }

    setChatSending(false);
  };

  // Init
  useEffect(() => {
    loadUser();
    loadMyRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime chat subscription per room
  useEffect(() => {
    if (!activeRoom) return;

    const channel = supabase
      .channel(`room_messages_${activeRoom.room_id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "room_messages",
          filter: `room_id=eq.${activeRoom.room_id}`,
        },
        async () => {
          // keep it simple: reload last 50
          const { data, error } = await supabase.rpc("get_room_messages", {
            p_room_id: activeRoom.room_id,
            p_limit: 50,
          });
          if (!error) {
            setRoomMsgs(([...(data ?? [])] as MsgRow[]).reverse());
            setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeRoom]);

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
          <TopBar title={headerTitle} />

          {/* Header card */}
          <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[12px] font-semibold text-white/85">
                  {activeRoom ? "Room" : "Create / Join"}
                </div>
                <div className="mt-1 text-[12px] text-white/65">
                  {activeRoom
                    ? `Mode: ${activeRoom.mode === "word" ? "Quick-Word" : "Quick-Photo"} • Target: ${
                        activeRoom.target_points
                      }`
                    : "Private groups with separate scoring + chat."}
                </div>
              </div>

              {activeRoom ? (
                <button
                  onClick={() => {
                    setActiveRoom(null);
                    setRoomBoard([]);
                    setRoomMsgs([]);
                    setRoomMsg(null);
                    setTab("rooms");
                  }}
                  className="shrink-0 rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[11px] text-white/75 active:scale-[0.98]"
                >
                  ✕ Close
                </button>
              ) : (
                <div className="shrink-0 rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[11px] text-white/75">
                  👥 Rooms
                </div>
              )}
            </div>
          </div>

          {/* If inside a room: actions */}
          {activeRoom ? (
            <div className="mt-4 space-y-2">
              <Card
                icon="🔄"
                title="Refresh room"
                subtitle="Reload leaderboard and chat"
                variant="accent"
                onClick={refreshActiveRoom}
              />
              <div className="rounded-3xl border border-white/12 bg-white/6 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[12px] font-semibold text-white/85">Invite code</div>
                  <div className="text-[11px] text-white/45">Share with friends</div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/12 bg-white/5 text-[16px]">
                    🔑
                  </div>
                  <input
                    value={activeRoom.code}
                    readOnly
                    className="w-full rounded-2xl border border-white/12 bg-slate-950/40 px-4 py-3 text-[15px] outline-none"
                  />
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(activeRoom.code);
                      } catch {}
                    }}
                    className="rounded-2xl border border-white/12 bg-white/6 px-4 py-3 text-[13px] text-white/85 active:scale-[0.98]"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              <Segmented
                value={tab}
                onChange={(v) => setTab(v as Tab)}
                cols={3}
                options={[
                  { value: "rooms", label: "Rooms", icon: "👥" },
                  { value: "create", label: "Create", icon: "➕" },
                  { value: "join", label: "Join", icon: "🔗" },
                ]}
              />
            </div>
          )}
        </header>

        {/* CONTENT */}
        <section className="mt-5 space-y-2">
          {/* ROOM LIST */}
          {!activeRoom && tab === "rooms" ? (
            <>
              {roomsLoading ? (
                <div className="rounded-3xl border border-white/12 bg-white/6 p-4 text-white/70">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/12 bg-white/5 text-[16px]">
                      ⏳
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-white/85">Loading</div>
                      <div className="text-[11px] text-white/55">Fetching your rooms…</div>
                    </div>
                  </div>
                </div>
              ) : roomsMsg ? (
                <div className="rounded-3xl border border-rose-400/25 bg-rose-500/10 p-4 text-white/85">
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl border border-rose-300/20 bg-rose-500/10 text-[16px]">
                      ⚠️
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold">Error</div>
                      <div className="mt-1 text-[12px] text-white/80">{roomsMsg}</div>
                    </div>
                  </div>
                </div>
              ) : myRooms.length === 0 ? (
                <div className="rounded-3xl border border-white/12 bg-white/6 p-4 text-white/70">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/12 bg-white/5 text-[16px]">
                      💤
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-white/85">No rooms yet</div>
                      <div className="text-[11px] text-white/55">
                        Create a room or join using a code.
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="rounded-3xl border border-white/12 bg-white/6 p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-[12px] font-semibold text-white/85">Your rooms</div>
                      <div className="text-[11px] text-white/55">Max 3 for now</div>
                    </div>
                  </div>

                  {myRooms.map((r) => (
                    <Card
                      key={r.room_id}
                      icon={r.mode === "word" ? "⌨️" : "📸"}
                      title={`Room ${r.code}`}
                      subtitle={`Target ${r.target_points} • Created ${new Date(r.created_at).toLocaleDateString()}`}
                      right={r.mode === "word" ? "Quick-Word" : "Quick-Photo"}
                      onClick={() => openRoom(r)}
                    />
                  ))}

                  <Card
                    icon="🔄"
                    title="Refresh rooms"
                    subtitle="Reload your list"
                    variant="accent"
                    onClick={loadMyRooms}
                  />
                </>
              )}
            </>
          ) : null}

          {/* CREATE */}
          {!activeRoom && tab === "create" ? (
            <div className="space-y-2">
              <div className="rounded-3xl border border-white/12 bg-white/6 p-4">
                <div className="text-[12px] font-semibold text-white/85">Game mode</div>
                <div className="mt-3">
                  <Segmented
                    value={createMode}
                    onChange={(v) => setCreateMode(v as Mode)}
                    options={[
                      { value: "word", label: "Quick-Word", icon: "⌨️" },
                      { value: "photo", label: "Quick-Photo", icon: "📸" },
                    ]}
                  />
                </div>
              </div>

              <div className="rounded-3xl border border-white/12 bg-white/6 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[12px] font-semibold text-white/85">Target points</div>
                  <div className="text-[11px] text-white/45">e.g. 1000</div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/12 bg-white/5 text-[16px]">
                    🎯
                  </div>
                  <input
                    value={String(targetPoints)}
                    onChange={(e) => setTargetPoints(Number(e.target.value || "0"))}
                    inputMode="numeric"
                    className="w-full rounded-2xl border border-white/12 bg-slate-950/40 px-4 py-3 text-[15px] outline-none focus:border-white/25 focus:bg-slate-950/55"
                    placeholder="1000"
                  />
                </div>
              </div>

              <div className="rounded-3xl border border-white/12 bg-white/6 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[12px] font-semibold text-white/85">Add friends (emails)</div>
                  <div className="text-[11px] text-white/45">comma / new line</div>
                </div>

                <textarea
                  value={inviteText}
                  onChange={(e) => setInviteText(e.target.value)}
                  rows={4}
                  placeholder={"friend1@mail.com\nfriend2@mail.com"}
                  className="mt-3 w-full rounded-2xl border border-white/12 bg-slate-950/40 px-4 py-3 text-[14px] outline-none focus:border-white/25 focus:bg-slate-950/55"
                />

                <div className="mt-3 text-[11px] text-white/55">
                  MVP: this stores invites in DB. Email sending comes later.
                </div>
              </div>

              {createMsg ? (
                <div className="rounded-3xl border border-rose-400/25 bg-rose-500/10 p-4 text-white/85">
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl border border-rose-300/20 bg-rose-500/10 text-[16px]">
                      ⚠️
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold">Create failed</div>
                      <div className="mt-1 text-[12px] text-white/80">{createMsg}</div>
                    </div>
                  </div>
                </div>
              ) : null}

              <button
                onClick={createRoom}
                disabled={createLoading}
                className={cx(
                  "group relative overflow-hidden w-full rounded-3xl border border-blue-300/25",
                  "bg-gradient-to-b from-blue-500/22 to-blue-500/10",
                  "px-5 py-4 text-left transition touch-manipulation",
                  "hover:-translate-y-[1px] hover:border-blue-300/45 hover:shadow-[0_0_45px_rgba(59,130,246,0.28)]",
                  "active:scale-[0.98]",
                  createLoading && "opacity-70 pointer-events-none"
                )}
              >
                <div
                  className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-blue-500/16 blur-2xl"
                  aria-hidden="true"
                />
                <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-white/6" aria-hidden="true" />

                <div className="relative z-[2] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl border border-blue-300/25 bg-blue-500/12 text-[16px]">
                      ➕
                    </div>
                    <div>
                      <div className="text-[15px] font-semibold">
                        {createLoading ? "Creating…" : "Create room"}
                      </div>
                      <div className="mt-1 text-[11px] text-white/65">
                        Private scoring + chat
                      </div>
                    </div>
                  </div>
                  <div className="text-white/55">→</div>
                </div>
              </button>
            </div>
          ) : null}

          {/* JOIN */}
          {!activeRoom && tab === "join" ? (
            <div className="space-y-2">
              <div className="rounded-3xl border border-white/12 bg-white/6 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[12px] font-semibold text-white/85">Room code</div>
                  <div className="text-[11px] text-white/45">6 chars</div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/12 bg-white/5 text-[16px]">
                    🔗
                  </div>
                  <input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="K3F9Q2"
                    className="w-full rounded-2xl border border-white/12 bg-slate-950/40 px-4 py-3 text-[15px] outline-none focus:border-white/25 focus:bg-slate-950/55"
                  />
                </div>
              </div>

              {joinMsg ? (
                <div className="rounded-3xl border border-rose-400/25 bg-rose-500/10 p-4 text-white/85">
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl border border-rose-300/20 bg-rose-500/10 text-[16px]">
                      ⚠️
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold">Join failed</div>
                      <div className="mt-1 text-[12px] text-white/80">{joinMsg}</div>
                    </div>
                  </div>
                </div>
              ) : null}

              <Card
                icon={joinLoading ? "⏳" : "✅"}
                title={joinLoading ? "Joining…" : "Join room"}
                subtitle="You’ll see it under Rooms"
                variant="accent"
                onClick={joinLoading ? undefined : joinRoom}
              />
            </div>
          ) : null}

          {/* ROOM VIEW */}
          {activeRoom ? (
            <>
              {roomLoading ? (
                <div className="rounded-3xl border border-white/12 bg-white/6 p-4 text-white/70">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/12 bg-white/5 text-[16px]">
                      ⏳
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-white/85">Loading room</div>
                      <div className="text-[11px] text-white/55">Leaderboard + chat…</div>
                    </div>
                  </div>
                </div>
              ) : roomMsg ? (
                <div className="rounded-3xl border border-rose-400/25 bg-rose-500/10 p-4 text-white/85">
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl border border-rose-300/20 bg-rose-500/10 text-[16px]">
                      ⚠️
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold">Room error</div>
                      <div className="mt-1 text-[12px] text-white/80">{roomMsg}</div>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Leaderboard */}
              <div className="rounded-3xl border border-white/12 bg-white/6 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-[12px] font-semibold text-white/85">Room ranking</div>
                  <div className="text-[11px] text-white/55">Top 100</div>
                </div>
                <div className="mt-3 space-y-2">
                  {roomBoard.length === 0 ? (
                    <div className="text-[12px] text-white/60">
                      No points yet. Once you wire room scoring, it will show here.
                    </div>
                  ) : (
                    roomBoard.map((r) => (
                      <div
                        key={r.user_id}
                        className="rounded-3xl border border-white/12 bg-white/5 p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="rounded-full border border-white/12 bg-white/6 px-2 py-0.5 text-[10px] text-white/70">
                                #{r.place}
                              </span>
                              <div className="truncate text-[13px] font-semibold text-white/90">
                                {r.username || "Player"}
                              </div>
                            </div>
                            <div className="mt-1 text-[11px] text-white/55 truncate">
                              {r.user_id}
                            </div>
                          </div>
                          <div className="shrink-0 rounded-2xl border border-white/12 bg-white/6 px-3 py-2">
                            <div className="text-[10px] text-white/55">Points</div>
                            <div className="text-[15px] font-extrabold">{r.points_total}</div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Chat */}
              <div className="rounded-3xl border border-white/12 bg-white/6 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-[12px] font-semibold text-white/85">Chat</div>
                  <div className="text-[11px] text-white/55">{roomMsgs.length} msgs</div>
                </div>

                <div className="mt-3 max-h-[42vh] overflow-auto rounded-2xl border border-white/10 bg-slate-950/30 p-3">
                  {roomMsgs.length === 0 ? (
                    <div className="text-[12px] text-white/60">No messages yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {roomMsgs.map((m) => {
                        const mine = userId && m.user_id === userId;
                        return (
                          <div
                            key={m.id}
                            className={cx(
                              "max-w-[92%] rounded-2xl border px-3 py-2",
                              mine
                                ? "ml-auto border-blue-300/20 bg-blue-500/12"
                                : "mr-auto border-white/12 bg-white/5"
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-[10px] font-semibold text-white/70">
                                {mine ? "You" : m.username || "Player"}
                              </div>
                              <div className="text-[10px] text-white/45">
                                {new Date(m.created_at).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            </div>
                            <div className="mt-1 text-[13px] text-white/90 whitespace-pre-wrap">
                              {m.message}
                            </div>
                          </div>
                        );
                      })}
                      <div ref={chatEndRef} />
                    </div>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <input
                    value={chatText}
                    onChange={(e) => setChatText(e.target.value)}
                    placeholder="Type a message…"
                    className="w-full rounded-2xl border border-white/12 bg-slate-950/40 px-4 py-3 text-[14px] outline-none focus:border-white/25 focus:bg-slate-950/55"
                  />
                  <button
                    onClick={sendChat}
                    disabled={chatSending}
                    className={cx(
                      "rounded-2xl border border-blue-300/25 bg-blue-500/12 px-4 py-3 text-[13px] text-white/90 active:scale-[0.98]",
                      chatSending && "opacity-70 pointer-events-none"
                    )}
                  >
                    Send
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </section>

        <footer className="mt-auto pb-2 pt-8 text-center text-[11px] text-white/40">
          Quick • Rooms
        </footer>
      </div>
    </main>
  );
}
