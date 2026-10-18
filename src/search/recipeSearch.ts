import {
  categoryName,
  ingredientById,
  teacherName,
} from "../services/catalogue";
import type { Recipe } from "../types/models";

export function recipeSearchText(recipe: Recipe) {
  const ingredientText = recipe.ingredients
    .map((entry) => {
      const ingredient = ingredientById(entry.ingredientId);
      return `${ingredient?.english ?? ""} ${ingredient?.telugu ?? ""} ${ingredient?.teluguInEnglish ?? ""} ${entry.quantity} ${entry.note ?? ""}`;
    })
    .join(" ");

  return `${recipe.name} ${recipe.nickname ?? ""} ${recipe.note ?? ""} ${categoryName(recipe.categoryId)} ${teacherName(recipe.teacherId)} ${ingredientText} ${recipe.steps.map((step) => step.instruction).join(" ")}`
    .normalize("NFC")
    .toLocaleLowerCase();
}

const normalizeQuery = (value: string) =>
  value.normalize("NFC").trim().toLocaleLowerCase();

const compact = (value: string) => value.replace(/[\s\p{P}\p{S}]+/gu, "");

const editDistance = (left: string, right: string) => {
  const previous = Array.from(
    { length: right.length + 1 },
    (_, index) => index,
  );
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = previous[0];
    previous[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const above = previous[rightIndex];
      previous[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + 1,
        diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[right.length];
};

const fuzzyScore = (query: string, text: string) => {
  if (query.length < 5) return 0;
  const queryCompact = compact(query);
  const words = text.split(/\s+/u).filter(Boolean);
  const candidates = new Set<string>();
  for (let index = 0; index < words.length; index += 1) {
    for (
      let width = 1;
      width <= 3 && index + width <= words.length;
      width += 1
    ) {
      candidates.add(compact(words.slice(index, index + width).join(" ")));
    }
  }
  const allowedDistance = Math.max(1, Math.ceil(queryCompact.length * 0.22));
  let best = 0;
  for (const candidate of candidates) {
    if (
      !candidate ||
      Math.abs(candidate.length - queryCompact.length) > allowedDistance
    ) {
      continue;
    }
    const distance = editDistance(queryCompact, candidate);
    if (distance <= allowedDistance) {
      best = Math.max(
        best,
        0.5 +
          0.5 *
            (1 - distance / Math.max(queryCompact.length, candidate.length)),
      );
    }
  }
  return best;
};

/** Returns a relevance score, with zero meaning no match. */
export function recipeSearchScore(recipe: Recipe, query: string) {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) return 1;
  const text = recipeSearchText(recipe);
  if (text.includes(normalizedQuery)) return 1;
  if (compact(text).includes(compact(normalizedQuery))) return 0.98;
  return fuzzyScore(normalizedQuery, text);
}
