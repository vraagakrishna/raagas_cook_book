import type { Ingredient } from "../types/models";

export const ingredientPronunciationPath = (ingredient: Ingredient) =>
  ingredient.pronunciationAudio ?? `./audio/ingredients/${ingredient.id}.mp3`;
