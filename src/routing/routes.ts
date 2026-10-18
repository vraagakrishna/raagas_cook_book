export type Route = { page: "home" } | { page: "recipe"; id: string };

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
    return { page: "recipe", id: readId(legacyHashMatch[1]) };
  }

  const routeBase = normalizeBase(base);
  const relativePath = pathname.startsWith(routeBase)
    ? pathname.slice(routeBase.length)
    : pathname.replace(/^\//, "");
  const pathMatch = relativePath.match(/^recipe\/([^/?#]+)\/?$/);
  return pathMatch
    ? { page: "recipe", id: readId(pathMatch[1]) }
    : { page: "home" };
}

export const homeUrl = (base = import.meta.env.BASE_URL) => normalizeBase(base);

export const recipeUrl = (id: string, base = import.meta.env.BASE_URL) =>
  `${normalizeBase(base)}recipe/${encodeURIComponent(id)}`;
