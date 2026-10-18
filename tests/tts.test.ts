import { describe, expect, it } from "vitest";
import { getAllAudioUrls } from "google-tts-api/dist/getAudioUrl";

describe("Telugu audio URL generation", () => {
  it("requests Telugu speech from Google", () => {
    const [audio] = getAllAudioUrls("మిరపకాయ", { lang: "te" });

    expect(audio.shortText).toBe("మిరపకాయ");
    expect(audio.url).toContain("translate.google.com/translate_tts?");
    expect(audio.url).toContain("tl=te");
    expect(audio.url).toContain(encodeURIComponent("మిరపకాయ"));
  });
});
