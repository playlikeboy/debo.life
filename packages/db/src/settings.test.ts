import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, UserSettings } from "./settings";

describe("UserSettings", () => {
  it("fills every default from an empty row", () => {
    expect(DEFAULT_SETTINGS).toEqual({
      autonomy: 1,
      voice: { voice: "default", speed: 1, keepTranscripts: true },
      proactive: { dailyBriefing: false },
    });
  });

  it("replaces bad values with defaults instead of failing", () => {
    const parsed = UserSettings.parse({ autonomy: 9, voice: { speed: 5, keepTranscripts: false }, proactive: "yes" });
    expect(parsed.autonomy).toBe(1);
    expect(parsed.voice).toEqual({ voice: "default", speed: 1, keepTranscripts: false });
    expect(parsed.proactive).toEqual({ dailyBriefing: false });
  });
});
