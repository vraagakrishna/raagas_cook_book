import { describe, expect, it } from "vitest";
import { recipeSearchScore } from "../src/search/recipeSearch";
import type { Recipe } from "../src/types/models";

const pappuCharu: Recipe = {
  id: "00000000-0000-4000-8000-000000000000",
  name: "Pappu Charu",
  categoryId: "cat-curry",
  teacherId: "teacher-amma",
  servings: 4,
  difficulty: "easy",
  ingredients: [],
  steps: [{ id: "step-1", instruction: "Simmer until ready." }],
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

describe("recipe search", () => {
  it("matches a spoken phrase when recognition removes its space", () => {
    expect(recipeSearchScore(pappuCharu, "papucharu")).toBeGreaterThan(0);
  });

  it("matches a small spelling mistake without matching unrelated short words", () => {
    expect(recipeSearchScore(pappuCharu, "pappu charru")).toBeGreaterThan(0);
    expect(recipeSearchScore(pappuCharu, "rice")).toBe(0);
  });
});
