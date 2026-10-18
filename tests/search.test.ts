import { describe, expect, it } from "vitest";
import { recipes } from "../src/services/catalogue";
import { recipeSearchScore } from "../src/search/recipeSearch";

describe("recipe search", () => {
  it("matches a spoken phrase when recognition removes its space", () => {
    const recipe = recipes.find((item) => /pappu charu/i.test(item.name));
    expect(recipe).toBeDefined();
    expect(recipeSearchScore(recipe!, "papucharu")).toBeGreaterThan(0);
  });

  it("matches a small spelling mistake without matching unrelated short words", () => {
    const recipe = recipes.find((item) => /pappu charu/i.test(item.name));
    expect(recipe).toBeDefined();
    expect(recipeSearchScore(recipe!, "pappu charru")).toBeGreaterThan(0);
    expect(recipeSearchScore(recipe!, "rice")).toBe(0);
  });
});
