export type Route = { page: "home" } | { page: "recipe"; id: string };

const routeBase = window.location.pathname
  .replace(/recipe\/[^/]+\/?$/, "")
  .replace(/\/?$/, "/");

export function parseRoute(): Route {
  const hashMatch = window.location.hash.match(/^#\/recipe\/([^?]+)/);
  const pathMatch = window.location.pathname.match(/\/recipe\/([^/?#]+)/);
  return hashMatch
    ? { page: "recipe", id: hashMatch[1] }
    : pathMatch
      ? { page: "recipe", id: pathMatch[1] }
      : { page: "home" };
}

export const homeUrl = () => `${routeBase}#/`;
export const recipeUrl = (id: string) => `${routeBase}#/recipe/${id}`;
