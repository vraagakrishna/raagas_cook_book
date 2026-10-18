import { appConfig } from "../config/appConfig";
import type { Recipe } from "../types/models";
import { getActiveOwnerToken } from "./githubAuth";

interface GitHubContent {
  sha: string;
}

export interface RecipeFileVersion {
  sha: string;
}

export interface RecipeImageUpload {
  file: File;
  extension: "jpg" | "png" | "webp";
}

export type CatalogueFile = "ingredients" | "teachers" | "categories";

export class GitHubConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitHubConflictError";
  }
}

const repositoryApiUrl = (path: string) =>
  `https://api.github.com/repos/${encodeURIComponent(
    appConfig.github.repositoryOwner,
  )}/${encodeURIComponent(appConfig.github.repositoryName)}/contents/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

const authenticatedHeaders = () => {
  const token = getActiveOwnerToken();
  if (!token) {
    throw new Error("Owner access expired. Sign in again before saving.");
  }
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
};

const request = async (url: string, init: RequestInit = {}) => {
  try {
    return await fetch(url, {
      ...init,
      headers: {
        ...authenticatedHeaders(),
        ...init.headers,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new Error(
      "Could not reach GitHub. Your changes are still in the form; check your connection and try again.",
    );
  }
};

const getFile = async (path: string): Promise<GitHubContent | null> => {
  const response = await request(
    `${repositoryApiUrl(path)}?ref=${encodeURIComponent(
      appConfig.github.repositoryBranch,
    )}`,
  );
  if (response.status === 404) return null;
  if (response.status === 401 || response.status === 403) {
    throw new Error(
      "GitHub rejected this token. Sign in again with Contents read and write permission.",
    );
  }
  if (!response.ok) {
    throw new Error(`GitHub could not read ${path}.`);
  }
  return (await response.json()) as GitHubContent;
};

const deleteFile = async (path: string, message: string) => {
  const current = await getFile(path);
  if (!current) return;
  const response = await request(repositoryApiUrl(path), {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      sha: current.sha,
      branch: appConfig.github.repositoryBranch,
    }),
  });
  if (response.status === 409 || response.status === 422) {
    throw new GitHubConflictError(
      `GitHub changed ${path} while it was being deleted. Reload and try again.`,
    );
  }
  if (!response.ok) throw new Error(`GitHub could not delete ${path}.`);
};

export async function deleteRecipeFromGitHub(recipe: Recipe): Promise<void> {
  await deleteFile(
    `data/recipes/${recipe.id}.json`,
    `Delete recipe: ${recipe.name}`,
  );
  const imagePaths = [
    recipe.coverImage,
    ...(recipe.steps ?? []).map((step) => step.image),
  ]
    .filter((path): path is string => Boolean(path))
    .map((path) => path.replace(/^\.\//, "public/"));
  for (const path of [...new Set(imagePaths)])
    await deleteFile(path, `Delete images for recipe: ${recipe.name}`);
}

export const getRecipeFileVersion = async (
  recipeId: string,
): Promise<RecipeFileVersion | null> => {
  const file = await getFile(`data/recipes/${recipeId}.json`);
  return file ? { sha: file.sha } : null;
};

export const generateAvailableRecipeId = async () => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = crypto.randomUUID();
    if (!(await getRecipeFileVersion(candidate))) return candidate;
  }
  throw new Error("Could not generate an unused recipe ID. Please try again.");
};

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
};

const textToBase64 = (value: string) =>
  bytesToBase64(new TextEncoder().encode(value));

const putFile = async ({
  path,
  content,
  message,
  sha,
  conflictMessage,
}: {
  path: string;
  content: string;
  message: string;
  sha?: string;
  conflictMessage?: string;
}) => {
  const response = await request(repositoryApiUrl(path), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content,
      branch: appConfig.github.repositoryBranch,
      ...(sha ? { sha } : {}),
    }),
  });
  if (response.status === 409 || response.status === 422) {
    throw new GitHubConflictError(
      conflictMessage ??
        "This recipe changed in GitHub after the editor was opened. Copy any unsaved text you need, reload the latest recipe, and try again.",
    );
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error(
      "GitHub refused this save. Confirm that the token has Contents read and write permission and that the branch allows direct changes.",
    );
  }
  if (!response.ok) {
    throw new Error(`GitHub could not save ${path}.`);
  }
};

const saveCoverImage = async (
  recipeId: string,
  upload: RecipeImageUpload,
  recipeName: string,
) => {
  const path = `public/images/recipes/${recipeId}.${upload.extension}`;
  const existing = await getFile(path);
  const bytes = new Uint8Array(await upload.file.arrayBuffer());
  await putFile({
    path,
    content: bytesToBase64(bytes),
    message: `Add cover image for recipe: ${recipeName}`,
    sha: existing?.sha,
  });
  return `./images/recipes/${recipeId}.${upload.extension}`;
};

const saveStepImage = async (
  recipeId: string,
  stepId: string,
  upload: RecipeImageUpload,
  recipeName: string,
) => {
  const safeStepId = stepId.replace(/[^a-zA-Z0-9-]/g, "");
  const path = `public/images/recipes/${recipeId}-step-${safeStepId}.${upload.extension}`;
  const existing = await getFile(path);
  await putFile({
    path,
    content: bytesToBase64(new Uint8Array(await upload.file.arrayBuffer())),
    message: `Add step image for recipe: ${recipeName}`,
    sha: existing?.sha,
  });
  return `./images/recipes/${recipeId}-step-${safeStepId}.${upload.extension}`;
};

export async function saveIngredientImage(
  ingredientId: string,
  file: File,
  ingredientName = ingredientId,
) {
  const extensions: Record<string, "jpg" | "png" | "webp"> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const extension = extensions[file.type];
  if (!extension) throw new Error("Choose a JPEG, PNG, or WebP image.");
  if (file.size > 3 * 1024 * 1024)
    throw new Error("The ingredient image must be 3 MB or smaller.");
  const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const valid =
    extension === "jpg"
      ? signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff
      : extension === "png"
        ? signature[0] === 0x89 &&
          signature[1] === 0x50 &&
          signature[2] === 0x4e &&
          signature[3] === 0x47
        : String.fromCharCode(...signature.slice(0, 4)) === "RIFF" &&
          String.fromCharCode(...signature.slice(8, 12)) === "WEBP";
  if (!valid)
    throw new Error("The selected file does not match its image type.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("The selected image could not be decoded.");
  }
  const tooLarge =
    bitmap.width > 5000 ||
    bitmap.height > 5000 ||
    bitmap.width * bitmap.height > 20_000_000;
  bitmap.close();
  if (tooLarge)
    throw new Error(
      "Use an image no larger than 5000 × 5000 pixels and 20 megapixels.",
    );
  const path = `public/images/ingredients/${ingredientId}.${extension}`;
  const existing = await getFile(path);
  await putFile({
    path,
    content: bytesToBase64(new Uint8Array(await file.arrayBuffer())),
    message: `Add ingredient image for ingredient: ${ingredientName}`,
    sha: existing?.sha,
  });
  return `./images/ingredients/${ingredientId}.${extension}`;
}

export async function saveIngredientToGitHub(
  ingredient: { id: string },
  content: string,
  commitMessage: string,
): Promise<void> {
  const path = `data/ingredients/${ingredient.id}.json`;
  let lastConflict: GitHubConflictError | null = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await getFile(path);
    try {
      await putFile({
        path,
        content: textToBase64(`${content.trim()}\n`),
        message: commitMessage,
        sha: current?.sha,
        conflictMessage: `GitHub is still updating ingredient ${ingredient.id}. Please try saving again in a moment.`,
      });
      return;
    } catch (error) {
      if (!(error instanceof GitHubConflictError)) throw error;
      lastConflict = error;
      await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
    }
  }
  throw lastConflict ?? new GitHubConflictError("Could not save ingredient.");
}

export async function deleteIngredientFromGitHub(
  ingredientId: string,
  commitMessage: string,
): Promise<void> {
  await deleteFile(`data/ingredients/${ingredientId}.json`, commitMessage);
}

export async function saveRecipeToGitHub({
  recipe,
  expectedSha,
  imageUpload,
  stepImageUploads,
}: {
  recipe: Recipe;
  expectedSha: string | null;
  imageUpload?: RecipeImageUpload;
  stepImageUploads?: Record<string, RecipeImageUpload>;
}): Promise<Recipe> {
  const recipePath = `data/recipes/${recipe.id}.json`;
  const currentFile = await getFile(recipePath);

  if (expectedSha === null && currentFile) {
    throw new GitHubConflictError(
      "A recipe with this generated ID already exists. Close this form and create the recipe again.",
    );
  }
  if (expectedSha !== null && currentFile?.sha !== expectedSha) {
    throw new GitHubConflictError(
      "This recipe changed in GitHub after the editor was opened. Copy any unsaved text you need, reload the latest recipe, and try again.",
    );
  }

  let savedRecipe = imageUpload
    ? {
        ...recipe,
        coverImage: await saveCoverImage(recipe.id, imageUpload, recipe.name),
      }
    : recipe;
  if (stepImageUploads && Object.keys(stepImageUploads).length) {
    const steps = await Promise.all(
      savedRecipe.steps.map(async (step) => {
        const upload = stepImageUploads[step.id];
        return upload
          ? {
              ...step,
              image: await saveStepImage(
                recipe.id,
                step.id,
                upload,
                recipe.name,
              ),
            }
          : step;
      }),
    );
    savedRecipe = { ...savedRecipe, steps };
  }

  await putFile({
    path: recipePath,
    content: textToBase64(`${JSON.stringify(savedRecipe, null, 2)}\n`),
    message: expectedSha
      ? `Update recipe: ${savedRecipe.name}`
      : `Add recipe: ${savedRecipe.name}`,
    sha: expectedSha ?? undefined,
  });
  return savedRecipe;
}

export async function saveCatalogueFile(
  kind: CatalogueFile,
  records: unknown[],
  commitMessage = `Update ${kind} catalogue`,
): Promise<void> {
  const path = `data/${kind}.json`;
  // GitHub's Contents API can briefly return the previous SHA while a commit
  // is propagating. Retry with a fresh SHA so adding two catalogue entries in
  // quick succession does not force the owner to reload the page.
  let lastConflict: GitHubConflictError | null = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await getFile(path);
    try {
      await putFile({
        path,
        content: textToBase64(`${JSON.stringify(records, null, 2)}\n`),
        message: commitMessage,
        sha: current?.sha,
        conflictMessage: `GitHub is still updating ${kind}. Please try saving again in a moment.`,
      });
      return;
    } catch (error) {
      if (!(error instanceof GitHubConflictError)) throw error;
      lastConflict = error;
      await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
    }
  }
  throw lastConflict ?? new GitHubConflictError(`Could not save ${kind}.`);
}
