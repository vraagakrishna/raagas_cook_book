import { describe, expect, it } from "vitest";
import {
  homeUrl,
  catalogueUrl,
  newRecipeUrl,
  parseRoute,
  recipeUrl,
} from "../src/routing/routes";
import { publicAssetUrl } from "../src/routing/publicAssetUrl";

describe("clean application routes", () => {
  it("does not add a hash to home URLs", () => {
    expect(homeUrl("/")).toBe("/");
    expect(homeUrl("/raagas_cook_book/")).toBe("/raagas_cook_book/");
  });

  it("builds clean recipe URLs beneath the deployment base", () => {
    expect(recipeUrl("recipe-id", "/")).toBe("/recipe/recipe-id");
    expect(recipeUrl("recipe-id", "/raagas_cook_book/")).toBe(
      "/raagas_cook_book/recipe/recipe-id",
    );
  });

  it("builds and parses the new-recipe route", () => {
    expect(newRecipeUrl("/")).toBe("/recipe/new");
    expect(parseRoute("/recipe/new", "", "/")).toEqual({
      page: "new-recipe",
    });
  });

  it("builds and parses the catalogue route", () => {
    expect(catalogueUrl("/")).toBe("/catalogue");
    expect(parseRoute("/catalogue", "", "/")).toEqual({ page: "catalogue" });
  });

  it("parses clean local and GitHub Pages recipe paths", () => {
    expect(parseRoute("/recipe/recipe-id", "", "/")).toEqual({
      page: "recipe",
      id: "recipe-id",
    });
    expect(
      parseRoute(
        "/raagas_cook_book/recipe/recipe-id",
        "",
        "/raagas_cook_book/",
      ),
    ).toEqual({ page: "recipe", id: "recipe-id" });
  });

  it("migrates an existing hash recipe link to its clean route", () => {
    expect(parseRoute("/", "#/recipe/recipe-id", "/")).toEqual({
      page: "recipe",
      id: "recipe-id",
    });
  });

  it("keeps repository assets working on nested recipe pages", () => {
    expect(
      publicAssetUrl("./images/recipes/example.svg", "/raagas_cook_book/"),
    ).toBe("/raagas_cook_book/images/recipes/example.svg");
  });
});
