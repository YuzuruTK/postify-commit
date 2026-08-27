import type { Env, LinkedInConnection, LinkedInUser } from "./types";

const AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const USERINFO_URL = "https://api.linkedin.com/v2/userinfo";
const POSTS_URL = "https://api.linkedin.com/rest/posts";
const LINKEDIN_VERSION = "202608";
const CONNECTION_KEY = "linkedin:connection";
const STATE_PREFIX = "linkedin:oauth-state:";
const STATE_TTL_SECONDS = 600;

function requiredEnv(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function createLinkedInAuthorizationUrl(env: Env, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: requiredEnv(env.LINKEDIN_CLIENT_ID, "LINKEDIN_CLIENT_ID"),
    redirect_uri: requiredEnv(env.LINKEDIN_REDIRECT_URI, "LINKEDIN_REDIRECT_URI"),
    state,
    scope: "openid profile w_member_social",
  });
  return `${AUTH_URL}?${params}`;
}

export async function exchangeCode(env: Env, code: string): Promise<LinkedInConnection> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: requiredEnv(env.LINKEDIN_CLIENT_ID, "LINKEDIN_CLIENT_ID"),
    client_secret: requiredEnv(env.LINKEDIN_CLIENT_SECRET, "LINKEDIN_CLIENT_SECRET"),
    redirect_uri: requiredEnv(env.LINKEDIN_REDIRECT_URI, "LINKEDIN_REDIRECT_URI"),
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) throw new Error(`LinkedIn token exchange failed (${response.status})`);
  const token = await response.json<{
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    refresh_token_expires_in?: number;
  }>();

  const user = await fetchUser(env, token.access_token);
  const now = Date.now();

  return {
    accessToken: token.access_token,
    expiresAt: now + token.expires_in * 1000,
    refreshToken: token.refresh_token,
    refreshTokenExpiresAt: token.refresh_token_expires_in
      ? now + token.refresh_token_expires_in * 1000
      : undefined,
    user,
  };
}

async function fetchUser(env: Env, accessToken: string): Promise<LinkedInUser> {
  const response = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`LinkedIn userinfo request failed (${response.status})`);

  const user = await response.json<LinkedInUser>();
  if (!user.sub) throw new Error("LinkedIn did not return a member identifier");
  return user;
}

async function refreshConnection(env: Env, connection: LinkedInConnection): Promise<LinkedInConnection> {
  if (!connection.refreshToken) throw new Error("LinkedIn access token expired; reconnect the account");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: connection.refreshToken,
    client_id: requiredEnv(env.LINKEDIN_CLIENT_ID, "LINKEDIN_CLIENT_ID"),
    client_secret: requiredEnv(env.LINKEDIN_CLIENT_SECRET, "LINKEDIN_CLIENT_SECRET"),
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) throw new Error(`LinkedIn token refresh failed (${response.status})`);

  const token = await response.json<{
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    refresh_token_expires_in?: number;
  }>();

  const now = Date.now();
  return {
    ...connection,
    accessToken: token.access_token,
    expiresAt: now + token.expires_in * 1000,
    refreshToken: token.refresh_token ?? connection.refreshToken,
    refreshTokenExpiresAt: token.refresh_token_expires_in
      ? now + token.refresh_token_expires_in * 1000
      : connection.refreshTokenExpiresAt,
  };
}

export async function getConnection(env: Env): Promise<LinkedInConnection | null> {
  return (await env.LINKEDIN_KV.get<LinkedInConnection>(CONNECTION_KEY, "json")) ?? null;
}

async function getValidConnection(env: Env): Promise<LinkedInConnection> {
  const connection = await getConnection(env);
  if (!connection) throw new Error("LinkedIn account is not connected");

  if (connection.expiresAt > Date.now() + 60_000) return connection;

  if (connection.refreshTokenExpiresAt && connection.refreshTokenExpiresAt <= Date.now()) {
    throw new Error("LinkedIn refresh token expired; reconnect the account");
  }

  const refreshed = await refreshConnection(env, connection);
  await env.LINKEDIN_KV.put(CONNECTION_KEY, JSON.stringify(refreshed));
  return refreshed;
}

export async function publishPost(env: Env, commentary: string): Promise<string> {
  const connection = await getValidConnection(env);
  const author = `urn:li:person:${connection.user.sub}`;

  const response = await fetch(POSTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${connection.accessToken}`,
      "Content-Type": "application/json",
      "Linkedin-Version": LINKEDIN_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author,
      commentary,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`LinkedIn publication failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  const postId = response.headers.get("x-restli-id");
  if (!postId) throw new Error("LinkedIn published the post but did not return its ID");
  return postId;
}

export const linkedinStorage = {
  connectionKey: CONNECTION_KEY,
  statePrefix: STATE_PREFIX,
  stateTtlSeconds: STATE_TTL_SECONDS,
};
