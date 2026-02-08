"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type GroupMode = "word" | "photo";
type DuelMode = "fast_round" | "hidden_word";
type RoomType = "group" | "duel";

type Tab = "rooms" | "create" | "join";

type MyRoom = {
  room_id: string;
  code: string;
  mode: GroupMode; // for group rooms
  target_points: number;
  created_at: string;
  // new (may be null for old rooms)
  room_type?: RoomType;
  duel_mode?: DuelMode | null;
};

type RoomInfo = {
  room_id: string;
  code: string;
  mode: GroupMode;
  target_points: number;
  current_round: number;
  is_active: boolean;
  winner_user_id: string | null;
  winner_username: string | null;
  is_owner: boolean;

  room_type?: RoomType;
  duel_mode?: DuelMode | null;
  game_seed?: string | null;
  game_start_at?: string | null;
};

type RoomRow = {
  place: number;
  user_id: string;
  username: string;
  points_total: number;
};

type MsgRow = {
  id: number;
  user_id: string;
  username: string;
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
  options: Array<{ value: string; label: string; icon: string; hint?: string }>;
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
                    {active ? "Selected" : o.hint ?? "Tap to switch"}
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
          <div
            className={cx(
              "grid h-10 w-10 place-items-center rounded-2xl border text-[16px]",
              variant === "accent"
                ? "border-blue-300/25 bg-blue-500/12"
                : variant === "danger"
                ? "border-rose-300/25 bg-rose-500/12"
                : "border-white/12 bg-white/5"
            )}
          >
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
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("rooms");
  const [userId, setUserId] = useState<string | null>(null);

  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsMsg, setRoomsMsg] = useState<string | null>(null);
  const [myRooms, setMyRooms] = useState<MyRoom[]>([]);

  const [activeRoom, setActiveRoom] = useState<MyRoom | null>(null);
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);

  const [roomBoard, setRoomBoard] = useState<RoomRow[]>([]);
  const [roomMsgs, setRoomMsgs] = useState<MsgRow[]>([]);
  const [roomLoading, setRoomLoading] = useState(false);
  const [roomMsg, setRoomMsg] = useState<string | null>(null);

  // Create
  const [createRoomType, setCreateRoomType] = useState<RoomType>("group");

  // Group create
  const [createMode, setCreateMode] = useState<GroupMode>("word");
  const [targetPoints, setTargetPoints] = useState<number>(1000);

  // Duel create
  const [createDuelMode, setCreateDuelMode] = useState<DuelMode>("fast_round");

  const [createLoading, setCreateLoading] = useState(false);
  const [createMsg, setCreateMsg] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  // Join
  const [joinCode, setJoinCode] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinMsg, setJoinMsg] = useState<string | null>(null);

  // Chat
  const [chatText, setChatText] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // Actions
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Duel state
  const [duelReadyMine, setDuelReadyMine] = useState(false);
  const [duelReadyOther, setDuelReadyOther] = useState(false);
  const [duelStartPayload, setDuelStartPayload] = useState<{ seed: string; startAt: string; duelMode: DuelMode } | null>(
    null
  );
  const [duelStatusMsg, setDuelStatusMsg] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const headerTitle = useMemo(() => {
    if (activeRoom) return `Room • ${activeRoom.code}`;
    return "Rooms";
  }, [activeRoom]);

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

    // NOTE: stari RPC možda ne vraća room_type/duel_mode — zato je optional
    setMyRooms((data ?? []) as MyRoom[]);
    setRoomsLoading(false);
  };

  const loadRoomInfo = async (roomId: string) => {
    const { data, error } = await supabase.rpc("get_room_info", { p_room_id: roomId });
    if (!error) setRoomInfo(((data ?? [])[0] ?? null) as RoomInfo | null);
  };

  const loadDuelState = async (roomId: string) => {
    setDuelStatusMsg(null);

    const { data, error } = await supabase.rpc("get_duel_state", { p_room_id: roomId });
    if (error) {
      setDuelStatusMsg(error.message);
      return;
    }

    const ok = (data as any)?.ok;
    if (!ok) {
      setDuelStatusMsg((data as any)?.error ?? "Failed to load duel state");
      return;
    }

    const room = (data as any)?.room ?? {};
    const ready = ((data as any)?.ready ?? []) as Array<{ user_id: string; is_ready: boolean }>;

    const mine = !!userId && ready.find((x) => x.user_id === userId)?.is_ready;
    const other = ready.find((x) => x.user_id !== userId)?.is_ready;

    setDuelReadyMine(!!mine);
    setDuelReadyOther(!!other);

    if (room?.seed && room?.start_at && room?.duel_mode) {
      setDuelStartPayload({ seed: room.seed, startAt: room.start_at, duelMode: room.duel_mode });
    } else {
      setDuelStartPayload(null);
    }
  };

  const openRoom = async (room: MyRoom) => {
    setActiveRoom(room);
    setRoomLoading(true);
    setRoomMsg(null);
    setChatError(null);
    setActionMsg(null);
    setDuelStatusMsg(null);
    setDuelStartPayload(null);
    setDuelReadyMine(false);
    setDuelReadyOther(false);

    await loadRoomInfo(room.room_id);

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

    // If duel room: load duel state too
    const isDuel = (room.room_type ?? "group") === "duel";
    if (isDuel) await loadDuelState(room.room_id);

    setRoomLoading(false);
  };

  const refreshActiveRoom = async () => {
    if (!activeRoom) return;

    await loadRoomInfo(activeRoom.room_id);

    const [lb, msgs] = await Promise.all([
      supabase.rpc("get_room_leaderboard", { p_room_id: activeRoom.room_id, p_limit: 100 }),
      supabase.rpc("get_room_messages", { p_room_id: activeRoom.room_id, p_limit: 50 }),
    ]);

    if (!lb.error) setRoomBoard((lb.data ?? []) as RoomRow[]);
    if (!msgs.error) setRoomMsgs(([...(msgs.data ?? [])] as MsgRow[]).reverse());

    const isDuel = (activeRoom.room_type ?? "group") === "duel";
    if (isDuel) await loadDuelState(activeRoom.room_id);
  };

  const createRoom = async () => {
    setCreateLoading(true);
    setCreateMsg(null);
    setCreatedCode(null);

    // GROUP
    if (createRoomType === "group") {
      const { data, error } = await supabase.rpc("create_room", {
        p_mode: createMode,
        p_target_points: targetPoints,
        p_invite_emails: [],
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

      const code = (data as any)?.code as string | undefined;
      if (code) setCreatedCode(code);

      await loadMyRooms();
      setTab("rooms");
      setCreateLoading(false);
      return;
    }

    // DUEL
    const { data, error } = await supabase.rpc("create_duel_room", { p_duel_mode: createDuelMode });

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

    const code = (data as any)?.code as string | undefined;
    if (code) setCreatedCode(code);

    await loadMyRooms();
    setTab("rooms");
    setCreateLoading(false);
  };

  const joinRoom = async () => {
    setJoinLoading(true);
    setJoinMsg(null);

    // prvo probaj duel join; ako nije duel, fallback na group join
    const duelAttempt = await supabase.rpc("join_duel_room", { p_code: joinCode });
    if (!duelAttempt.error) {
      const ok = (duelAttempt.data as any)?.ok;
      if (ok) {
        await loadMyRooms();
        setTab("rooms");
        setJoinLoading(false);
        return;
      }
      // ako nije duel room, probamo group join
      const errCode = (duelAttempt.data as any)?.error;
      if (errCode && errCode !== "not_a_duel_room") {
        setJoinMsg(errCode);
        setJoinLoading(false);
        return;
      }
    }

    // group join
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

    setChatError(null);

    const msg = chatText.trim();
    if (!msg) {
      setChatError("Message is empty.");
      return;
    }

    setChatSending(true);

    const { data, error } = await supabase.rpc("send_room_message", {
      p_room_id: activeRoom.room_id,
      p_message: msg,
    });

    if (error) {
      setChatError(error.message);
      setChatSending(false);
      return;
    }

    const ok = (data as any)?.ok;
    if (!ok) {
      setChatError((data as any)?.error ?? "Send failed");
      setChatSending(false);
      return;
    }

    setChatText("");
    await refreshActiveRoom();
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    setChatSending(false);
  };

  const setReady = async (ready: boolean) => {
    if (!activeRoom) return;
    setDuelStatusMsg(null);

    const { data, error } = await supabase.rpc("set_duel_ready", {
      p_room_id: activeRoom.room_id,
      p_ready: ready,
    });

    if (error) {
      setDuelStatusMsg(error.message);
      return;
    }
    if (!(data as any)?.ok) {
      setDuelStatusMsg((data as any)?.error ?? "Failed to set ready");
      return;
    }

    await loadDuelState(activeRoom.room_id);
  };

  const tryStart = async () => {
    if (!activeRoom) return;
    setDuelStatusMsg(null);

    const { data, error } = await supabase.rpc("try_start_duel", { p_room_id: activeRoom.room_id });
    if (error) {
      setDuelStatusMsg(error.message);
      return;
    }
    if (!(data as any)?.ok) {
      setDuelStatusMsg((data as any)?.error ?? "Not ready");
      return;
    }

    const duelMode = (data as any)?.duel_mode as DuelMode;
    const seed = (data as any)?.seed as string;
    const startAt = (data as any)?.start_at as string;

    setDuelStartPayload({ duelMode, seed, startAt });
  };

  const goToDuelGame = (payload: { duelMode: DuelMode; seed: string; startAt: string }) => {
    if (!activeRoom) return;

    const base =
      payload.duelMode === "fast_round"
        ? "/fast-round"
        : "/hidden-word";

    // game pages će čitati room/seed/start
    router.push(
      `${base}?room=${encodeURIComponent(activeRoom.room_id)}&seed=${encodeURIComponent(
        payload.seed
      )}&start=${encodeURIComponent(payload.startAt)}`
    );
  };

  const startAgain = async () => {
    if (!activeRoom) return;
    setActionLoading(true);
    setActionMsg(null);

    const { data, error } = await supabase.rpc("reset_room", { p_room_id: activeRoom.room_id });

    if (error) {
      setActionMsg(error.message);
      setActionLoading(false);
      return;
    }

    if (!(data as any)?.ok) {
      setActionMsg((data as any)?.error ?? "Reset failed");
      setActionLoading(false);
      return;
    }

    await refreshActiveRoom();
    setActionLoading(false);
  };

  const deleteRoom = async () => {
    if (!activeRoom) return;

    const really = window.confirm("Delete this room? This cannot be undone.");
    if (!really) return;

    setActionLoading(true);
    setActionMsg(null);

    const { data, error } = await supabase.rpc("delete_room", { p_room_id: activeRoom.room_id });

    if (error) {
      setActionMsg(error.message);
      setActionLoading(false);
      return;
    }

    if (!(data as any)?.ok) {
      setActionMsg((data as any)?.error ?? "Delete failed");
      setActionLoading(false);
      return;
    }

    setActiveRoom(null);
    setRoomInfo(null);
    setRoomBoard([]);
    setRoomMsgs([]);
    setRoomMsg(null);
    setChatError(null);
    setActionMsg(null);

    await loadMyRooms();
    setTab("rooms");
    setActionLoading(false);
  };

  useEffect(() => {
    loadUser();
    loadMyRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // realtime: chat insert
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

  // realtime: ready state changes (duel)
  useEffect(() => {
    if (!activeRoom) return;
    const isDuel = (activeRoom.room_type ?? "group") === "duel";
    if (!isDuel) return;

    const channel = supabase
      .channel(`room_ready_${activeRoom.room_id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_ready",
          filter: `room_id=eq.${activeRoom.room_id}`,
        },
        async () => {
          await loadDuelState(activeRoom.room_id);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${activeRoom.room_id}`,
        },
        async () => {
          await loadDuelState(activeRoom.room_id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoom, userId]);

  // auto navigate when start payload appears
  useEffect(() => {
    if (!activeRoom) return;
    const isDuel = (activeRoom.room_type ?? "group") === "duel";
    if (!isDuel) return;
    if (!duelStartPayload) return;

    // čim payload postoji -> oba klijenta idu u igru
    goToDuelGame(duelStartPayload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duelStartPayload]);

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

          <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[12px] font-semibold text-white/85">
                  {activeRoom ? "Room" : "Create / Join"}
                </div>
                <div className="mt-1 text-[12px] text-white/65">
                  {activeRoom ? (
                    (activeRoom.room_type ?? "group") === "duel" ? (
                      `Type: 1on1 • Mode: ${
                        (activeRoom.duel_mode ?? "fast_round") === "fast_round" ? "Fast Round" : "Hidden Word"
                      }`
                    ) : (
                      `Type: Group • Mode: ${activeRoom.mode === "word" ? "Quick-Word" : "Quick-Photo"} • Target: ${
                        activeRoom.target_points
                      }`
                    )
                  ) : (
                    "Private rooms (group or 1on1). Key-only invite."
                  )}
                </div>
              </div>

              {activeRoom ? (
                <button
                  onClick={() => {
                    setActiveRoom(null);
                    setRoomInfo(null);
                    setRoomBoard([]);
                    setRoomMsgs([]);
                    setRoomMsg(null);
                    setChatError(null);
                    setActionMsg(null);
                    setDuelStatusMsg(null);
                    setDuelStartPayload(null);
                    setDuelReadyMine(false);
                    setDuelReadyOther(false);
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
                  <div className="text-[12px] font-semibold text-white/85">Invite key</div>
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

              {/* DUEL PLAY PANEL */}
              {(activeRoom.room_type ?? "group") === "duel" ? (
                <div className="rounded-3xl border border-blue-300/20 bg-blue-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl border border-blue-300/25 bg-blue-500/12 text-[16px]">
                      ⚔️
                    </div>
                    <div className="min-w-0 w-full">
                      <div className="text-[13px] font-semibold text-white/90">1on1</div>
                      <div className="mt-1 text-[12px] text-white/65">
                        Both players must press <b>Play</b>. Then the match starts on both phones.
                      </div>

                      {duelStatusMsg ? (
                        <div className="mt-3 rounded-2xl border border-rose-400/25 bg-rose-500/10 p-3 text-[12px] text-white/85">
                          ⚠️ {duelStatusMsg}
                        </div>
                      ) : null}

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-2xl border border-white/12 bg-white/6 p-3">
                          <div className="text-[11px] text-white/55">You</div>
                          <div className="mt-1 text-[13px] font-semibold">
                            {duelReadyMine ? "Ready ✅" : "Not ready"}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-white/12 bg-white/6 p-3">
                          <div className="text-[11px] text-white/55">Opponent</div>
                          <div className="mt-1 text-[13px] font-semibold">
                            {duelReadyOther ? "Ready ✅" : "Not ready"}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setReady(!duelReadyMine)}
                          className={cx(
                            "rounded-2xl border px-4 py-3 text-[13px] font-semibold active:scale-[0.98]",
                            duelReadyMine
                              ? "border-emerald-300/25 bg-emerald-500/10 text-emerald-100"
                              : "border-blue-300/25 bg-blue-500/12 text-white/90"
                          )}
                        >
                          {duelReadyMine ? "Unready" : "Play (Ready)"}
                        </button>

                        <button
                          onClick={tryStart}
                          className={cx(
                            "rounded-2xl border border-blue-300/25 bg-gradient-to-b from-blue-500/22 to-blue-500/10 px-4 py-3 text-[13px] font-semibold text-white/95 active:scale-[0.98]",
                            !(duelReadyMine && duelReadyOther) && "opacity-60 pointer-events-none"
                          )}
                        >
                          Start
                        </button>
                      </div>

                      <div className="mt-2 text-[11px] text-white/45">
                        Start button becomes available only when both are Ready.
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* GROUP WINNER PANEL stays as you already had */}
              {roomInfo && !roomInfo.is_active && (activeRoom.room_type ?? "group") === "group" ? (
                <div className="rounded-3xl border border-blue-300/20 bg-blue-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl border border-blue-300/25 bg-blue-500/12 text-[16px]">
                      🏆
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-white/90">Winner</div>
                      <div className="mt-1 text-[14px] font-extrabold">
                        {roomInfo.winner_username || "Player"}
                      </div>
                      <div className="mt-1 text-[11px] text-white/60">
                        Game finished at {roomInfo.target_points} points.
                      </div>

                      {roomInfo.is_owner ? (
                        <button
                          onClick={startAgain}
                          disabled={actionLoading}
                          className={cx(
                            "mt-3 w-full rounded-3xl border border-blue-300/25 bg-blue-500/12 px-5 py-4 text-left transition active:scale-[0.98]",
                            actionLoading && "opacity-70 pointer-events-none"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-[15px] font-semibold">
                                {actionLoading ? "Starting…" : "Start again"}
                              </div>
                              <div className="mt-1 text-[11px] text-white/65">
                                New round, room points reset to 0
                              </div>
                            </div>
                            <div className="text-white/55">→</div>
                          </div>
                        </button>
                      ) : (
                        <div className="mt-3 text-[11px] text-white/60">
                          Waiting for owner to start again.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
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

        <section className="mt-5 space-y-2">
          {/* ROOMS LIST */}
          {!activeRoom && tab === "rooms" ? (
            <>
              {createdCode ? (
                <div className="rounded-3xl border border-blue-300/20 bg-blue-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl border border-blue-300/25 bg-blue-500/12 text-[16px]">
                      ✅
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-white/90">Room created</div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="rounded-2xl border border-white/12 bg-white/6 px-3 py-2 text-[14px] font-extrabold tracking-widest">
                          {createdCode}
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(createdCode);
                            } catch {}
                          }}
                          className="rounded-2xl border border-white/12 bg-white/6 px-4 py-2 text-[13px] text-white/85 active:scale-[0.98]"
                        >
                          Copy
                        </button>
                      </div>
                      <div className="mt-2 text-[11px] text-white/60">
                        Share this key so others can join.
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

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
                        Create a room or join using a key.
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="rounded-3xl border border-white/12 bg-white/6 p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-[12px] font-semibold text-white/85">Your rooms</div>
                      <div className="text-[11px] text-white/55">Max 3 (owner rooms)</div>
                    </div>
                  </div>

                  {myRooms.map((r) => {
                    const t = (r.room_type ?? "group") as RoomType;
                    const isDuel = t === "duel";
                    const right = isDuel
                      ? (r.duel_mode ?? "fast_round") === "fast_round"
                        ? "1on1 • Fast Round"
                        : "1on1 • Hidden Word"
                      : r.mode === "word"
                      ? "Group • Quick-Word"
                      : "Group • Quick-Photo";

                    const subtitle = isDuel
                      ? `Key ${r.code} • Created ${new Date(r.created_at).toLocaleDateString()}`
                      : `Target ${r.target_points} • Created ${new Date(r.created_at).toLocaleDateString()}`;

                    return (
                      <Card
                        key={r.room_id}
                        icon={isDuel ? "⚔️" : r.mode === "word" ? "⌨️" : "📸"}
                        title={`Room ${r.code}`}
                        subtitle={subtitle}
                        right={right}
                        onClick={() => openRoom(r)}
                      />
                    );
                  })}

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
                <div className="text-[12px] font-semibold text-white/85">Room type</div>
                <div className="mt-3">
                  <Segmented
                    value={createRoomType}
                    onChange={(v) => setCreateRoomType(v as RoomType)}
                    options={[
                      { value: "group", label: "Group", icon: "👥", hint: "Quick-Word/Photo" },
                      { value: "duel", label: "1on1", icon: "⚔️", hint: "Ready → Play" },
                    ]}
                  />
                </div>
              </div>

              {createRoomType === "group" ? (
                <>
                  <div className="rounded-3xl border border-white/12 bg-white/6 p-4">
                    <div className="text-[12px] font-semibold text-white/85">Game mode</div>
                    <div className="mt-3">
                      <Segmented
                        value={createMode}
                        onChange={(v) => setCreateMode(v as GroupMode)}
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
                </>
              ) : (
                <div className="rounded-3xl border border-white/12 bg-white/6 p-4">
                  <div className="text-[12px] font-semibold text-white/85">1on1 mode</div>
                  <div className="mt-3">
                    <Segmented
                      value={createDuelMode}
                      onChange={(v) => setCreateDuelMode(v as DuelMode)}
                      options={[
                        { value: "fast_round", label: "Fast Round", icon: "⚡", hint: "Same scramble" },
                        { value: "hidden_word", label: "Hidden Word", icon: "🧩", hint: "Same letters" },
                      ]}
                    />
                  </div>
                  <div className="mt-2 text-[11px] text-white/45">
                    Players join by key, both press Play, then match starts.
                  </div>
                </div>
              )}

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
                      <div className="text-[15px] font-semibold">{createLoading ? "Creating…" : "Create room"}</div>
                      <div className="mt-1 text-[11px] text-white/65">Key-only invite</div>
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
                  <div className="text-[12px] font-semibold text-white/85">Room key</div>
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
              {/* Leaderboard (ONLY for group rooms; duel modes can later get duel results screen) */}
              {(activeRoom.room_type ?? "group") === "group" ? (
                <div className="rounded-3xl border border-white/12 bg-white/6 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-[12px] font-semibold text-white/85">
                      Room ranking {roomInfo ? `• Round ${roomInfo.current_round}` : ""}
                    </div>
                    <div className="text-[11px] text-white/55">{roomInfo?.is_active ? "Live" : "Finished"}</div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {roomBoard.length === 0 ? (
                      <div className="text-[12px] text-white/60">No points yet. Points start from 0 for this room round.</div>
                    ) : (
                      roomBoard.map((r) => (
                        <div key={r.user_id} className="rounded-3xl border border-white/12 bg-white/5 p-3">
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
              ) : null}

              {/* Chat */}
              <div className="rounded-3xl border border-white/12 bg-white/6 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-[12px] font-semibold text-white/85">Chat</div>
                  <div className="text-[11px] text-white/55">{roomMsgs.length} msgs</div>
                </div>

                {chatError ? (
                  <div className="mt-3 rounded-2xl border border-rose-400/25 bg-rose-500/10 p-3 text-[12px] text-white/85">
                    <span className="mr-2">⚠️</span>
                    {chatError}
                  </div>
                ) : null}

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
                              mine ? "ml-auto border-blue-300/20 bg-blue-500/12" : "mr-auto border-white/12 bg-white/5"
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-[10px] font-semibold text-white/70">
                                {mine ? "You" : (m.username || "Player")}
                              </div>
                              <div className="text-[10px] text-white/45">
                                {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </div>
                            <div className="mt-1 text-[13px] text-white/90 whitespace-pre-wrap">{m.message}</div>
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
                    {chatSending ? "…" : "Send"}
                  </button>
                </div>
              </div>

              {/* Owner actions */}
              {roomInfo?.is_owner ? (
                <div className="pt-2">
                  {actionMsg ? (
                    <div className="mb-2 rounded-2xl border border-rose-400/25 bg-rose-500/10 p-3 text-[12px] text-white/85">
                      <span className="mr-2">⚠️</span>
                      {actionMsg}
                    </div>
                  ) : null}

                  <button
                    onClick={deleteRoom}
                    disabled={actionLoading}
                    className={cx(
                      "w-full rounded-3xl border border-rose-300/25 bg-rose-500/10 px-5 py-4 text-left transition active:scale-[0.98]",
                      actionLoading && "opacity-70 pointer-events-none"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[15px] font-semibold">Delete room</div>
                        <div className="mt-1 text-[11px] text-white/70">Removes room for everyone (cannot be undone)</div>
                      </div>
                      <div className="text-white/55">→</div>
                    </div>
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </section>

        <footer className="mt-auto pb-2 pt-8 text-center text-[11px] text-white/40">Quick • Rooms</footer>
      </div>
    </main>
  );
}
