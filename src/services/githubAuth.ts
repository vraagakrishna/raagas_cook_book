import { appConfig } from "../config/appConfig";

const tokenStorageKey = "raagas-github-owner-token";

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
}

export interface DeviceAuthorization {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresAt: number;
  intervalSeconds: number;
}

interface DeviceCodeResponse {
  device_code?: string;
  user_code?: string;
  verification_uri?: string;
  expires_in?: number;
  interval?: number;
  error?: string;
  error_description?: string;
}

interface AccessTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
  interval?: number;
}

const wait = (milliseconds: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(resolve, milliseconds);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeout);
        reject(new DOMException("Sign-in cancelled", "AbortError"));
      },
      { once: true },
    );
  });

const postForm = async <T>(url: string, body: URLSearchParams): Promise<T> => {
  const response = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json" },
    body,
  });
  if (!response.ok) throw new Error(`GitHub returned ${response.status}.`);
  return (await response.json()) as T;
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
    !appConfig.github.clientId ||
    appConfig.github.clientId.startsWith("YOUR_")
  ) {
    throw new Error(
      "Replace YOUR_GITHUB_APP_CLIENT_ID in src/config/appConfig.ts.",
    );
  }
  if (
    !appConfig.github.ownerUsername ||
    appConfig.github.ownerUsername.startsWith("YOUR_")
  ) {
    throw new Error("Replace YOUR_GITHUB_USERNAME in src/config/appConfig.ts.");
  }
  configuredOwnerId();
}

export async function requestDeviceAuthorization(): Promise<DeviceAuthorization> {
  assertGitHubAuthConfigured();
  const result = await postForm<DeviceCodeResponse>(
    "https://github.com/login/device/code",
    new URLSearchParams({ client_id: appConfig.github.clientId }),
  );
  if (
    result.error ||
    !result.device_code ||
    !result.user_code ||
    !result.verification_uri
  ) {
    throw new Error(
      result.error_description ??
        result.error ??
        "GitHub sign-in could not start.",
    );
  }
  return {
    deviceCode: result.device_code,
    userCode: result.user_code,
    verificationUri: result.verification_uri,
    expiresAt: Date.now() + (result.expires_in ?? 900) * 1000,
    intervalSeconds: result.interval ?? 5,
  };
}

export async function waitForDeviceAuthorization(
  authorization: DeviceAuthorization,
  signal: AbortSignal,
): Promise<string> {
  let intervalSeconds = authorization.intervalSeconds;
  while (Date.now() < authorization.expiresAt) {
    await wait(intervalSeconds * 1000, signal);
    const result = await postForm<AccessTokenResponse>(
      "https://github.com/login/oauth/access_token",
      new URLSearchParams({
        client_id: appConfig.github.clientId,
        device_code: authorization.deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    );
    if (result.access_token) return result.access_token;
    if (result.error === "authorization_pending") continue;
    if (result.error === "slow_down") {
      intervalSeconds = result.interval ?? intervalSeconds + 5;
      continue;
    }
    throw new Error(
      result.error_description ?? result.error ?? "GitHub sign-in failed.",
    );
  }
  throw new Error("The GitHub sign-in code expired. Please try again.");
}

export async function getAuthenticatedGitHubUser(
  token: string,
): Promise<GitHubUser> {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) throw new Error("The GitHub session is no longer valid.");
  return (await response.json()) as GitHubUser;
}

export async function verifyOwnerToken(token: string): Promise<GitHubUser> {
  assertGitHubAuthConfigured();
  const user = await getAuthenticatedGitHubUser(token);
  const expectedLogin = appConfig.github.ownerUsername.toLocaleLowerCase();
  if (
    user.id !== configuredOwnerId() ||
    user.login.toLocaleLowerCase() !== expectedLogin
  ) {
    throw new Error(`@${user.login} is not configured as the cookbook owner.`);
  }
  return user;
}

export const savedGitHubToken = () => sessionStorage.getItem(tokenStorageKey);

export const saveGitHubToken = (token: string) =>
  sessionStorage.setItem(tokenStorageKey, token);

export const clearGitHubToken = () =>
  sessionStorage.removeItem(tokenStorageKey);
