const externalUrl = /^(?:[a-z]+:)?\/\//i;

export function publicAssetUrl(path: string, base = import.meta.env.BASE_URL) {
  if (
    externalUrl.test(path) ||
    path.startsWith("data:") ||
    path.startsWith("blob:")
  ) {
    return path;
  }
  const normalizedBase = `/${base.replace(/^\/+|\/+$/g, "")}`.replace(
    /\/?$/,
    "/",
  );
  return `${normalizedBase}${path.replace(/^\.?\//, "")}`;
}
