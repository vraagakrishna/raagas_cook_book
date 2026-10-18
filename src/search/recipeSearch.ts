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

  return `${recipe.name} ${recipe.nickname ?? ""} ${recipe.description} ${categoryName(recipe.categoryId)} ${teacherName(recipe.teacherId)} ${ingredientText} ${recipe.steps.map((step) => step.instruction).join(" ")}`
    .normalize("NFC")
    .toLocaleLowerCase();
}
