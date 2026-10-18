import { appConfig } from "../config/appConfig";

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
}

interface GitHubRepository {
  full_name: string;
  permissions?: {
    push?: boolean;
  };
}

let activeOwnerToken: string | null = null;
const ownerTokenStorageKey = "raagas-github-owner-token";

const githubHeaders = (token: string) => ({
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2022-11-28",
});

const fetchFromGitHub = async (
  url: string,
  token: string,
  signal?: AbortSignal,
) => {
  try {
    return await fetch(url, {
      headers: githubHeaders(token),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new Error(
      "Could not reach GitHub. Check your connection and try again.",
    );
  }
};

const configuredOwnerId = () => {
  const value = Number(appConfig.github.ownerUserId);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(
      "Replace YOUR_GITHUB_NUMERIC_USER_ID in src/config/appConfig.ts.",
    );
  }
  return value;
};

export function assertGitHubAuthConfigured() {
  if (
    !appConfig.github.ownerUsername ||
    appConfig.github.ownerUsername.startsWith("YOUR_")
  ) {
    throw new Error("Replace YOUR_GITHUB_USERNAME in src/config/appConfig.ts.");
  }
  configuredOwnerId();
  if (
    !appConfig.github.repositoryOwner ||
    appConfig.github.repositoryOwner.startsWith("YOUR_") ||
    !appConfig.github.repositoryName ||
    appConfig.github.repositoryName.startsWith("YOUR_")
  ) {
    throw new Error(
      "Replace the GitHub repository owner and name in src/config/appConfig.ts.",
    );
  }
}

const validateTokenShape = (token: string) => {
  if (!token) throw new Error("Enter your fine-grained GitHub token.");
  if (!token.startsWith("github_pat_")) {
    throw new Error(
      "Use a fine-grained GitHub token. It should begin with github_pat_.",
    );
  }
};

export async function signInOwner(
  suppliedToken: string,
  signal?: AbortSignal,
): Promise<GitHubUser> {
  assertGitHubAuthConfigured();
  const token = suppliedToken.trim();
  validateTokenShape(token);

  const userResponse = await fetchFromGitHub(
    "https://api.github.com/user",
    token,
    signal,
  );
  if (userResponse.status === 401) {
    throw new Error("That GitHub token is invalid or has expired.");
  }
  if (!userResponse.ok) {
    throw new Error("GitHub could not verify this token.");
  }

  const user = (await userResponse.json()) as GitHubUser;
  const expectedLogin = appConfig.github.ownerUsername.toLocaleLowerCase();
  if (
    user.id !== configuredOwnerId() ||
    user.login.toLocaleLowerCase() !== expectedLogin
  ) {
    throw new Error(`@${user.login} is not configured as the cookbook owner.`);
  }

  const repositoryPath = `${encodeURIComponent(
    appConfig.github.repositoryOwner,
  )}/${encodeURIComponent(appConfig.github.repositoryName)}`;
  const repositoryResponse = await fetchFromGitHub(
    `https://api.github.com/repos/${repositoryPath}`,
    token,
    signal,
  );
  if (!repositoryResponse.ok) {
    throw new Error(
      "This token cannot access the configured cookbook repository.",
    );
  }

  const repository = (await repositoryResponse.json()) as GitHubRepository;
  const expectedRepository = `${appConfig.github.repositoryOwner}/${appConfig.github.repositoryName}`;
  if (
    repository.full_name.toLocaleLowerCase() !==
      expectedRepository.toLocaleLowerCase() ||
    repository.permissions?.push !== true
  ) {
    throw new Error(
      "This token does not have write access to the configured cookbook repository. Select only this repository and grant Contents read and write.",
    );
  }

  activeOwnerToken = token;
  if (typeof sessionStorage !== "undefined")
    sessionStorage.setItem(ownerTokenStorageKey, token);
  return user;
}

export const savedOwnerToken = () =>
  typeof sessionStorage === "undefined"
    ? null
    : sessionStorage.getItem(ownerTokenStorageKey);

export const getActiveOwnerToken = () => activeOwnerToken;

export const signOutOwner = () => {
  activeOwnerToken = null;
  if (typeof sessionStorage !== "undefined")
    sessionStorage.removeItem(ownerTokenStorageKey);
};
