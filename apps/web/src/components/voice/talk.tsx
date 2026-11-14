"use client";

import type { Participant, RemoteTrack, Room, TextStreamReader } from "livekit-client";
import { useEffect, useRef, useState } from "react";
import { entryHref } from "@/lib/links";

type Chip = { id: string; label: string };
type Line = { id: string; who: "you" | "debo"; text: string; final: boolean; sources: Chip[] };
type Status = "idle" | "connecting" | "live" | "ended" | "error";
type AgentState = "listening" | "thinking" | "speaking" | "initializing" | "";

/**
 * The Talk screen. Connects to a LiveKit room with a token from
 * /api/voice/token; Debo's voice agent joins the same room. The microphone
 * is on only between "Start talking" and "End", and the page says so.
 * Captions come from LiveKit's transcription stream; sources come on the
 * "debo.sources" topic. Audio is never recorded by Debo.
 */
export function TalkToDebo() {
  const [status, setStatus] = useState<Status>("idle");
  const [problem, setProblem] = useState("");
  const [muted, setMuted] = useState(false);
  const [agentState, setAgentState] = useState<AgentState>("");
  const [lines, setLines] = useState<Line[]>([]);
  const [typed, setTyped] = useState("");
  const roomRef = useRef<Room | null>(null);
  const audioRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => void roomRef.current?.disconnect(), []);

  function upsert(id: string, who: Line["who"], text: string, final: boolean) {
    setLines((all) => {
      const at = all.findIndex((l) => l.id === id);
      if (at === -1) return [...all, { id, who, text, final, sources: [] }];
      const next = [...all];
      const line = next[at];
      if (line) next[at] = { ...line, text, final };
      return next;
    });
  }

  function attachSources(sources: Chip[]) {
    setLines((all) => {
      const next = [...all];
      for (let i = next.length - 1; i >= 0; i--) {
        const line = next[i];
        if (line?.who === "you") {
          // Sources belong to Debo's reply after this question; keep them until it arrives.
          next.splice(i + 1, 0, { id: `src-${crypto.randomUUID()}`, who: "debo", text: "", final: false, sources });
          return next;
        }
      }
      return next;
    });
  }

  async function start() {
    setProblem("");
    setStatus("connecting");
    try {
      const response = await fetch("/api/voice/token", { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as { url?: string; token?: string; error?: string };
      if (!response.ok || !data.url || !data.token) throw new Error(data.error ?? "I couldn't start a voice session.");

      const { Room, RoomEvent, Track } = await import("livekit-client");
      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Audio) audioRef.current?.appendChild(track.attach());
      });
      room.on(RoomEvent.ParticipantAttributesChanged, (_changed: Record<string, string>, participant: Participant) => {
        const state = participant.attributes["lk.agent.state"];
        if (state) setAgentState(state as AgentState);
      });
      room.on(RoomEvent.Disconnected, () => {
        setStatus((s) => (s === "error" ? s : "ended"));
        setAgentState("");
      });

      room.registerTextStreamHandler("lk.transcription", async (reader: TextStreamReader, from: { identity: string }) => {
        const id = reader.info.attributes?.["lk.segment_id"] ?? reader.info.id;
        const who = from.identity === room.localParticipant.identity ? "you" : "debo";
        let text = "";
        for await (const chunk of reader) {
          text += chunk;
          upsert(id, who, text, false);
        }
        upsert(id, who, text, true);
      });
      room.registerTextStreamHandler("debo.sources", async (reader: TextStreamReader) => {
        try {
          const parsed = JSON.parse(await reader.readAll()) as Chip[];
          if (Array.isArray(parsed)) attachSources(parsed.filter((c) => typeof c?.id === "string" && typeof c?.label === "string"));
        } catch {
          // Ignore a bad message; the answer still plays.
        }
      });

      await room.connect(data.url, data.token);
      await room.localParticipant.setMicrophoneEnabled(true);
      setMuted(false);
      setStatus("live");
    } catch (error) {
      await roomRef.current?.disconnect();
      roomRef.current = null;
      setStatus("error");
      setProblem(
        error instanceof Error && error.name === "NotAllowedError"
          ? "Debo can't use your microphone. Allow it in your browser's settings, or type below instead."
          : error instanceof Error && error.message
            ? error.message
            : "I couldn't start a voice session. Check your connection and try again.",
      );
    }
  }

  async function end() {
    await roomRef.current?.disconnect();
    roomRef.current = null;
    setStatus("ended");
  }

  async function toggleMute() {
    const room = roomRef.current;
    if (!room) return;
    await room.localParticipant.setMicrophoneEnabled(muted);
    setMuted(!muted);
  }

  async function stopDebo() {
    const room = roomRef.current;
    if (!room) return;
    const agent = [...room.remoteParticipants.values()].find((p) => p.isAgent);
    if (!agent) return;
    await room.localParticipant
      .performRpc({ destinationIdentity: agent.identity, method: "debo.interrupt", payload: "" })
      .catch(() => {});
  }

  async function sendTyped(event: React.FormEvent) {
    event.preventDefault();
    const room = roomRef.current;
    const text = typed.trim();
    if (!room || !text) return;
    await room.localParticipant.sendText(text, { topic: "lk.chat" });
    upsert(`typed-${crypto.randomUUID()}`, "you", text, true);
    setTyped("");
  }

  const live = status === "live";
  const stateWords: Record<string, string> = {
    listening: muted ? "Microphone off" : "Listening",
    thinking: "Thinking",
    speaking: "Speaking",
    initializing: "Getting ready",
  };

  return (
    <section className="mt-8 grid gap-6" aria-label="Voice conversation">
      <div className="rounded-[24px] border-2 border-ink bg-paper p-5" style={{ boxShadow: "var(--shadow-hard)" }}>
        <p role="status" aria-live="polite" className="flex items-center gap-3 font-semibold">
          <span
            aria-hidden="true"
            className={`inline-block h-4 w-4 rounded-full border-2 border-ink ${live && !muted ? "bg-mint" : "bg-paper"} ${
              live && agentState === "listening" && !muted ? "motion-safe:animate-pulse" : ""
            }`}
          />
          {status === "idle" && "Not listening. Your microphone is off."}
          {status === "connecting" && "Connecting…"}
          {live && `Microphone ${muted ? "off" : "on"}. ${stateWords[agentState] ?? "Waiting for Debo to join"}.`}
          {status === "ended" && "Conversation ended. Your microphone is off."}
          {status === "error" && "Not connected. Your microphone is off."}
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          {!live && status !== "connecting" && (
            <button type="button" className="btn btn-primary" onClick={start}>
              {status === "idle" ? "Start talking" : "Start again"}
            </button>
          )}
          {live && (
            <>
              <button type="button" className="btn btn-primary" onClick={stopDebo} disabled={agentState !== "speaking"}>
                Stop Debo
              </button>
              <button type="button" className="btn btn-quiet" onClick={toggleMute} aria-pressed={muted}>
                {muted ? "Turn microphone on" : "Turn microphone off"}
              </button>
              <button type="button" className="btn btn-quiet" onClick={end}>
                End conversation
              </button>
            </>
          )}
        </div>
        {status === "idle" && (
          <p className="mt-4 text-ink-soft">
            Your browser will ask to use your microphone. Debo listens only while this conversation is on, and never
            keeps the recording. A written copy is saved in Chat unless you turn that off in Settings.
          </p>
        )}
        {problem && (
          <p role="alert" className="mt-4 font-semibold">
            {problem}
          </p>
        )}
      </div>

      <div ref={audioRef} hidden />

      <ol className="grid gap-3" aria-label="What was said" aria-live="polite">
        {lines
          .filter((l) => l.text || l.sources.length > 0)
          .map((line) => (
            <li
              key={line.id}
              className={`rounded-[18px] border border-line p-4 ${line.who === "you" ? "bg-sky/40" : "bg-paper"}`}
            >
              <p className="text-sm font-semibold text-ink-soft">{line.who === "you" ? "You" : "Debo"}</p>
              {line.text && <p className="mt-1 whitespace-pre-wrap wrap-anywhere">{line.text}</p>}
              {line.sources.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2" aria-label="Where this answer came from">
                  {line.sources.map((s) => (
                    <li key={s.id}>
                      <a href={entryHref(s.id)} className="chip min-h-11 no-underline hover:underline">
                        {s.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
      </ol>

      {live && (
        <form onSubmit={sendTyped} className="flex flex-wrap gap-3">
          <label htmlFor="voice-typed" className="sr-only">
            Type to Debo instead
          </label>
          <input
            id="voice-typed"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            maxLength={500}
            placeholder="Or type here"
            className="min-h-12 flex-1 rounded-[12px] border-2 border-ink bg-paper px-3"
          />
          <button type="submit" className="btn btn-quiet">
            Send
          </button>
        </form>
      )}
    </section>
  );
}
