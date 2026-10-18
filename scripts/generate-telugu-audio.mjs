import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getAudioBase64 } from "google-tts-api";

const ingredients = JSON.parse(await readFile("data/ingredients.json", "utf8"));
const outputDirectory = "public/audio/ingredients";
await mkdir(outputDirectory, { recursive: true });

for (const ingredient of ingredients) {
  if (!ingredient.telugu) continue;
  const base64 = await getAudioBase64(ingredient.telugu, {
    lang: "te",
    slow: false,
    timeout: 20000,
  });
  await writeFile(
    join(outputDirectory, `${ingredient.id}.mp3`),
    Buffer.from(base64, "base64"),
  );
  process.stdout.write(`Generated Telugu audio for ${ingredient.english}\n`);
}
