import { describe, expect, it } from "vitest";
import {
  categories,
  ingredients,
  recipes,
  teachers,
} from "../src/services/catalogue";
import type { Ingredient } from "../src/types/models";

const ingredientFiles = import.meta.glob<Ingredient>(
  "../data/ingredients/*.json",
  { eager: true, import: "default" },
);
const repositoryIngredients = Object.values(ingredientFiles);

describe("recipe catalogue", () => {
  it("has unique stable IDs and one record per file", () => {
    expect(new Set(recipes.map((recipe) => recipe.id)).size).toBe(
      recipes.length,
    );
    expect(recipes.every((recipe) => /^[0-9a-f-]{36}$/.test(recipe.id))).toBe(
      true,
    );
  });

  it("only references existing master data", () => {
    const categoryIds = new Set(categories.map((item) => item.id));
    const teacherIds = new Set(teachers.map((item) => item.id));
    const ingredientIds = new Set(ingredients.map((item) => item.id));
    recipes.forEach((recipe) => {
      expect(categoryIds.has(recipe.categoryId)).toBe(true);
      expect(teacherIds.has(recipe.teacherId)).toBe(true);
      recipe.ingredients.forEach((entry) =>
        expect(ingredientIds.has(entry.ingredientId)).toBe(true),
      );
    });
  });

  it("uses valid servings, durations and step orders", () => {
    recipes.forEach((recipe) => {
      expect(recipe.servings).toBeGreaterThan(0);
      expect(recipe.totalDurationMinutes ?? 0).toBeGreaterThanOrEqual(0);
      expect(recipe.steps.length).toBeGreaterThan(0);
      expect(new Set(recipe.steps.map((step) => step.id)).size).toBe(
        recipe.steps.length,
      );
    });
  });

  it("provides readable English transliteration for every ingredient", () => {
    const invalidIngredients = repositoryIngredients.flatMap((ingredient) => {
      return !ingredient.teluguInEnglish?.trim()
        ? [
            `Ingredient "${ingredient.english}" (${ingredient.id}) is missing Telugu in English`,
          ]
        : [];
    });

    expect(invalidIngredients, invalidIngredients.join("\n")).toEqual([]);
  });
});
