import { afterEach, describe, expect, it, vi } from "vitest";
import { appConfig } from "../src/config/appConfig";
import {
  GitHubConflictError,
  getRecipeFileVersion,
  saveRecipeToGitHub,
} from "../src/services/githubRecipes";
import { signInOwner, signOutOwner } from "../src/services/githubAuth";
import type { Recipe } from "../src/types/models";

const token = "github_pat_recipe-editor-test";
const owner = {
  id: Number(appConfig.github.ownerUserId),
  login: appConfig.github.ownerUsername,
  name: "Owner",
  avatar_url: "https://example.com/avatar.png",
};
const repository = {
  full_name: `${appConfig.github.repositoryOwner}/${appConfig.github.repositoryName}`,
  permissions: { push: true },
};
const recipe: Recipe = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Test recipe",
  categoryId: "cat-curry",
  teacherId: "teacher-amma",
  servings: 2,
  difficulty: "easy",
  ingredients: [{ ingredientId: "ing-onion", quantity: "1" }],
  steps: [{ id: "step-1", instruction: "Cook it." }],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const authenticatedFetch = (...followingResponses: Response[]) =>
  vi
    .fn()
    .mockResolvedValueOnce(response(owner))
    .mockResolvedValueOnce(response(repository))
    .mockResolvedValueOnce(followingResponses[0])
    .mockResolvedValueOnce(followingResponses[1]);

afterEach(() => {
  signOutOwner();
  vi.unstubAllGlobals();
});

describe("GitHub recipe persistence", () => {
  it("reads the repository file SHA used for edit conflict detection", async () => {
    const fetchMock = authenticatedFetch(response({ sha: "recipe-sha" }));
    vi.stubGlobal("fetch", fetchMock);
    await signInOwner(token);

    await expect(getRecipeFileVersion(recipe.id)).resolves.toEqual({
      sha: "recipe-sha",
    });
  });

  it("creates a new JSON recipe file on the configured branch", async () => {
    const fetchMock = authenticatedFetch(
      response({ message: "Not Found" }, 404),
      response({ content: { sha: "new-sha" } }, 201),
    );
    vi.stubGlobal("fetch", fetchMock);
    await signInOwner(token);

    await expect(
      saveRecipeToGitHub({ recipe, expectedSha: null }),
    ).resolves.toEqual(recipe);

    const [, putOptions] = fetchMock.mock.calls[3] as [string, RequestInit];
    expect(putOptions.method).toBe("PUT");
    const body = JSON.parse(String(putOptions.body));
    expect(body.branch).toBe(appConfig.github.repositoryBranch);
    expect(body.sha).toBeUndefined();
    expect(JSON.parse(atob(body.content))).toEqual(recipe);
  });

  it("stops an edit when the GitHub SHA changed", async () => {
    const fetchMock = authenticatedFetch(response({ sha: "newer-sha" }));
    vi.stubGlobal("fetch", fetchMock);
    await signInOwner(token);

    await expect(
      saveRecipeToGitHub({ recipe, expectedSha: "older-sha" }),
    ).rejects.toBeInstanceOf(GitHubConflictError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
