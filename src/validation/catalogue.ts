import type { Ingredient, MasterRecord, Recipe } from "../types/models";

export function validateCatalogue(
  recipes: Recipe[],
  ingredients: Ingredient[],
  teachers: MasterRecord[],
  categories: MasterRecord[],
) {
  const errors: string[] = [];
  const recipeIds = new Set<string>();
  const ingredientIds = new Set(ingredients.map((item) => item.id));
  const teacherIds = new Set(teachers.map((item) => item.id));
  const categoryIds = new Set(categories.map((item) => item.id));

  for (const recipe of recipes) {
    if (recipeIds.has(recipe.id))
      errors.push(`Duplicate recipe ID: ${recipe.id}`);
    recipeIds.add(recipe.id);
    if (!categoryIds.has(recipe.categoryId))
      errors.push(`${recipe.id}: unknown category`);
    if (!teacherIds.has(recipe.teacherId))
      errors.push(`${recipe.id}: unknown teacher`);
    if (recipe.servings <= 0)
      errors.push(`${recipe.id}: servings must be positive`);
    if ((recipe.totalDurationMinutes ?? 0) < 0)
      errors.push(`${recipe.id}: duration cannot be negative`);
    for (const entry of recipe.ingredients) {
      if (!ingredientIds.has(entry.ingredientId)) {
        errors.push(`${recipe.id}: unknown ingredient ${entry.ingredientId}`);
      }
    }
  }

  return errors;
}
