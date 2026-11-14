// Getting speech out of a recording: ffmpeg turns any voice or video file into
// a small mono 16 kHz mp3 (video: the picture is dropped, only the sound is
// kept), then cuts it into short pieces for the speech engine.
//
// ffmpeg is installed in the API's container image (see the Dockerfile). The
// file is only a temporary copy in a throwaway folder, deleted when the work
// ends; the recording itself lives in R2. ffmpeg is told to use only local
// files and pipes, so a hostile file cannot make it fetch a web address.
import { spawn } from "node:child_process";

export class AudioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AudioError";
  }
}

export interface AudioTools {
  /** Make a mono 16 kHz mp3 next to `input`. Returns its path and length. */
  prepare(input: string, outputDir: string): Promise<{ path: string; durationSeconds: number }>;
  /** Bytes of one piece of a prepared file. */
  slice(path: string, startSeconds: number, lengthSeconds: number): Promise<Uint8Array>;
  /** Turn a short clip (any format) into the mp3 the engine takes. For dictation. */
  toMp3(clip: Uint8Array): Promise<Uint8Array>;
}

const SAFE = ["-nostdin", "-hide_banner", "-v", "error", "-protocol_whitelist", "file,pipe"];
const ENCODE = ["-vn", "-sn", "-dn", "-ac", "1", "-ar", "16000", "-c:a", "libmp3lame", "-b:a", "32k"];

function run(
  command: string,
  args: string[],
  options: { input?: Uint8Array; timeoutMs: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    const out: Buffer[] = [];
    let errors = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), options.timeoutMs);
    child.stdout.on("data", (d: Buffer) => out.push(d));
    child.stderr.on("data", (d: Buffer) => {
      if (errors.length < 2000) errors += d.toString();
    });
    child.on("error", () => {
      clearTimeout(timer);
      reject(new AudioError(`${command} is not installed.`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      // The message can name the file's format, never its contents. It is logged by name only.
      if (code === 0) resolve(Buffer.concat(out));
      else reject(new AudioError(`${command} could not read the audio (exit ${code}).`));
    });
    child.stdin.on("error", () => {});
    child.stdin.end(options.input ? Buffer.from(options.input) : undefined);
  });
}

export function ffmpegTools(): AudioTools {
  return {
    async prepare(input, outputDir) {
      const path = `${outputDir}/speech.mp3`;
      await run("ffmpeg", [...SAFE, "-i", input, ...ENCODE, "-y", path], { timeoutMs: 15 * 60_000 });
      const probe = await run(
        "ffprobe",
        ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
        { timeoutMs: 30_000 },
      );
      const durationSeconds = Number.parseFloat(probe.toString().trim());
      if (!Number.isFinite(durationSeconds)) throw new AudioError("The recording has no sound I can read.");
      return { path, durationSeconds };
    },
    async slice(path, start, length) {
      const bytes = await run(
        "ffmpeg",
        [...SAFE, "-ss", String(start), "-t", String(length), "-i", path, "-c", "copy", "-f", "mp3", "pipe:1"],
        { timeoutMs: 60_000 },
      );
      return new Uint8Array(bytes);
    },
    async toMp3(clip) {
      const bytes = await run("ffmpeg", [...SAFE, "-i", "pipe:0", ...ENCODE, "-f", "mp3", "pipe:1"], {
        input: clip,
        timeoutMs: 60_000,
      });
      return new Uint8Array(bytes);
    },
  };
}

/** For tests and sample mode: no ffmpeg. The "mp3" is the original bytes and the length is whatever you say. */
export function fakeAudioTools(options: { durationSeconds?: number; fail?: boolean } = {}): AudioTools & { slices: number } {
  const fake = {
    slices: 0,
    async prepare(input: string) {
      if (options.fail) throw new AudioError("Not audio.");
      return { path: input, durationSeconds: options.durationSeconds ?? 12 };
    },
    async slice(path: string, start: number, length: number) {
      fake.slices += 1;
      return new TextEncoder().encode(`slice ${path} ${start} ${length}`);
    },
    async toMp3(clip: Uint8Array) {
      if (options.fail) throw new AudioError("Not audio.");
      return clip;
    },
  };
  return fake;
}
