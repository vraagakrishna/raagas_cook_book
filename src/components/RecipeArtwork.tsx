import { CookingPot } from "lucide-react";
import type { Recipe } from "../types/models";

export function RecipeArtwork({ recipe }: { recipe: Recipe }) {
  return recipe.coverImage ? (
    <img className="recipe-cover" src={recipe.coverImage} alt="" />
  ) : (
    <span className="recipe-placeholder" aria-hidden="true">
      <CookingPot size={58} strokeWidth={1.2} />
    </span>
  );
}
