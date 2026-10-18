import type { Recipe } from "../types/models";
import { publicAssetUrl } from "../routing/publicAssetUrl";

export function RecipeArtwork({ recipe }: { recipe: Recipe }) {
  return recipe.coverImage ? (
    <img
      className="recipe-cover"
      src={publicAssetUrl(recipe.coverImage)}
      alt=""
    />
  ) : (
    <span className="recipe-placeholder" aria-hidden="true">
      <img
        className="recipe-placeholder-logo"
        src={publicAssetUrl("favicon.svg")}
        alt=""
      />
    </span>
  );
}
