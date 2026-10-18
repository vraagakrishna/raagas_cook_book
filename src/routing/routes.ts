export type Route =
  | { page: "home" }
  | { page: "new-recipe" }
  | { page: "catalogue" }
  | { page: "recipe"; id: string };

const normalizeBase = (base: string) => {
  const withLeadingSlash = base.startsWith("/") ? base : `/${base}`;
  return withLeadingSlash.replace(/\/?$/, "/");
};

const readId = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export function parseRoute(
  pathname = window.location.pathname,
  hash = window.location.hash,
  base = import.meta.env.BASE_URL,
): Route {
  const legacyHashMatch = hash.match(/^#\/recipe\/([^?]+)/);
  if (legacyHashMatch) {
    if (legacyHashMatch[1] === "new") return { page: "new-recipe" };
    return { page: "recipe", id: readId(legacyHashMatch[1]) };
  }

  const routeBase = normalizeBase(base);
  const relativePath = pathname.startsWith(routeBase)
    ? pathname.slice(routeBase.length)
    : pathname.replace(/^\//, "");
  const pathMatch = relativePath.match(/^recipe\/([^/?#]+)\/?$/);
  if (relativePath === "recipe/new" || relativePath === "recipe/new/") {
    return { page: "new-recipe" };
  }
  if (relativePath === "catalogue" || relativePath === "catalogue/") {
    return { page: "catalogue" };
  }
  return pathMatch
    ? { page: "recipe", id: readId(pathMatch[1]) }
    : { page: "home" };
}

export const homeUrl = (base = import.meta.env.BASE_URL) => normalizeBase(base);

export const recipeUrl = (id: string, base = import.meta.env.BASE_URL) =>
  `${normalizeBase(base)}recipe/${encodeURIComponent(id)}`;

export const newRecipeUrl = (base = import.meta.env.BASE_URL) =>
  `${normalizeBase(base)}recipe/new`;

export const catalogueUrl = (base = import.meta.env.BASE_URL) =>
  `${normalizeBase(base)}catalogue`;
