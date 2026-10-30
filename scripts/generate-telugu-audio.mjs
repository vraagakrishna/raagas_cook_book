import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getAudioBase64 } from "google-tts-api";

const ingredientFiles = (await readdir("data/ingredients")).filter((file) =>
  file.endsWith(".json"),
);
const ingredients = await Promise.all(
  ingredientFiles.map(async (file) =>
    JSON.parse(await readFile(join("data/ingredients", file), "utf8")),
  ),
);
const outputDirectory = "public/audio/ingredients";
await mkdir(outputDirectory, { recursive: true });

for (const ingredient of ingredients) {
  const pronunciationText =
    ingredient.telugu?.trim() || ingredient.teluguInEnglish?.trim();
  if (!pronunciationText) continue;
  const base64 = await getAudioBase64(pronunciationText, {
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
