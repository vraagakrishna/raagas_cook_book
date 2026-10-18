import categoriesData from "../../data/categories.json";
import ingredientsData from "../../data/ingredients.json";
import teachersData from "../../data/teachers.json";
import type { Ingredient, MasterRecord, Recipe } from "../types/models";
import { validateCatalogue } from "../validation/catalogue";

const recipeFiles = import.meta.glob<Recipe>("../../data/recipes/*.json", {
  eager: true,
  import: "default",
});

export const categories = categoriesData as MasterRecord[];
export const teachers = teachersData as MasterRecord[];
export const ingredients = ingredientsData as Ingredient[];
export const recipes = Object.values(recipeFiles).sort((a, b) =>
  a.id.localeCompare(b.id),
);

const catalogueErrors = validateCatalogue(
  recipes,
  ingredients,
  teachers,
  categories,
);
if (catalogueErrors.length) {
  throw new Error(`Invalid recipe catalogue:\n${catalogueErrors.join("\n")}`);
}

export const categoryName = (id: string) =>
  categories.find((item) => item.id === id)?.name ?? "Uncategorised";

export const teacherName = (id: string) =>
  teachers.find((item) => item.id === id)?.name ?? "Unknown";

export const ingredientById = (id: string) =>
  ingredients.find((item) => item.id === id);
