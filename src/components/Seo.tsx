import { useEffect } from "react";
import type { Recipe } from "../types/models";
import { publicAssetUrl } from "../routing/publicAssetUrl";
import { ingredientById } from "../services/catalogue";

const baseSiteName = "Raaga's Cook Book";
const baseDescription =
  "A lovingly kept collection of family recipes, ingredients, and kitchen memories.";

const setMeta = (name: string, content: string, property = false) => {
  const attribute = property ? "property" : "name";
  let element = document.head.querySelector<HTMLMetaElement>(
    `meta[${attribute}="${name}"]`,
  );
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, name);
    document.head.appendChild(element);
  }
  element.content = content;
};

const removeMeta = (name: string, property = false) => {
  const attribute = property ? "property" : "name";
  document.head.querySelector(`meta[${attribute}="${name}"]`)?.remove();
};

const setCanonical = (url: string) => {
  let link = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]',
  );
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = url;
};

export function Seo({
  recipe,
  page = "home",
}: {
  recipe?: Recipe;
  page?: "home" | "new-recipe" | "catalogue" | "recipe";
}) {
  useEffect(() => {
    const baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin);
    const canonicalUrl = new URL(window.location.pathname, baseUrl.origin);
    const title = recipe
      ? `${recipe.name} | ${baseSiteName}`
      : page === "catalogue"
        ? `Recipe Catalogue | ${baseSiteName}`
        : page === "new-recipe"
          ? `Add a Recipe | ${baseSiteName}`
          : baseSiteName;
    const description = recipe
      ? `Cook ${recipe.name}, a treasured recipe from Raaga's family cookbook.`
      : page === "catalogue"
        ? "Browse the ingredients, teachers, and categories in Raaga's recipe catalogue."
        : page === "new-recipe"
          ? "Add a treasured family recipe to Raaga's Cook Book."
          : baseDescription;
    const image = recipe?.coverImage
      ? new URL(publicAssetUrl(recipe.coverImage), baseUrl).href
      : "";

    document.title = title;
    setMeta("description", description);
    setMeta("robots", "index,follow");
    setMeta("og:title", title, true);
    setMeta("og:description", description, true);
    setMeta("og:type", recipe ? "article" : "website", true);
    setMeta("og:url", canonicalUrl.href, true);
    setMeta("og:site_name", baseSiteName, true);
    setMeta("twitter:card", image ? "summary_large_image" : "summary");
    setMeta("twitter:title", title);
    setMeta("twitter:description", description);
    if (image) {
      setMeta("og:image", image, true);
      setMeta("twitter:image", image);
    } else {
      removeMeta("og:image", true);
      removeMeta("twitter:image");
    }
    setCanonical(canonicalUrl.href);

    const structuredData = recipe
      ? {
          "@context": "https://schema.org",
          "@type": "Recipe",
          name: recipe.name,
          author: { "@type": "Person", name: "Raaga" },
          recipeYield: recipe.servings
            ? `${recipe.servings} servings`
            : undefined,
          totalTime: recipe.totalDurationMinutes
            ? `PT${recipe.totalDurationMinutes}M`
            : undefined,
          image: image ? [image] : undefined,
          recipeIngredient: recipe.ingredients.map(
            (ingredient) =>
              `${ingredient.quantity} ${ingredientById(ingredient.ingredientId)?.english ?? "ingredient"}`,
          ),
          recipeInstructions: recipe.steps.map((step) => ({
            "@type": "HowToStep",
            text: step.instruction,
          })),
          mainEntityOfPage: canonicalUrl.href,
        }
      : {
          "@context": "https://schema.org",
          "@type": page === "catalogue" ? "ItemList" : "CollectionPage",
          name: baseSiteName,
          description: baseDescription,
          url: canonicalUrl.href,
        };
    let script = document.head.querySelector<HTMLScriptElement>(
      'script[data-seo-structured-data="true"]',
    );
    if (!script) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.dataset.seoStructuredData = "true";
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(structuredData);
  }, [page, recipe]);

  return null;
}
