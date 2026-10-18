import { afterEach, describe, expect, it, vi } from "vitest";
import { appConfig } from "../src/config/appConfig";
import {
  getActiveOwnerToken,
  signInOwner,
  signOutOwner,
} from "../src/services/githubAuth";

const token = "github_pat_test-owner-token";
const owner = {
  id: Number(appConfig.github.ownerUserId),
  login: appConfig.github.ownerUsername,
  name: "Cookbook owner",
  avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

afterEach(() => {
  signOutOwner();
  vi.unstubAllGlobals();
});

describe("GitHub owner access", () => {
  it("keeps a verified repository token only in memory", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(owner))
      .mockResolvedValueOnce(
        jsonResponse({
          full_name: `${appConfig.github.repositoryOwner}/${appConfig.github.repositoryName}`,
          permissions: { push: true },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(signInOwner(`  ${token}  `)).resolves.toEqual(owner);
    expect(getActiveOwnerToken()).toBe(token);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    signOutOwner();
    expect(getActiveOwnerToken()).toBeNull();
  });

  it("rejects tokens that are not fine-grained", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(signInOwner("ghp_classic-token")).rejects.toThrow(
      "fine-grained GitHub token",
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getActiveOwnerToken()).toBeNull();
  });

  it("rejects a valid token belonging to another account", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        jsonResponse({
          ...owner,
          id: owner.id + 1,
          login: "someone-else",
        }),
      ),
    );

    await expect(signInOwner(token)).rejects.toThrow(
      "is not configured as the cookbook owner",
    );
    expect(getActiveOwnerToken()).toBeNull();
  });

  it("rejects a token without repository write access", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(owner))
        .mockResolvedValueOnce(
          jsonResponse({
            full_name: `${appConfig.github.repositoryOwner}/${appConfig.github.repositoryName}`,
            permissions: { push: false },
          }),
        ),
    );

    await expect(signInOwner(token)).rejects.toThrow(
      "does not have write access",
    );
    expect(getActiveOwnerToken()).toBeNull();
  });
});
