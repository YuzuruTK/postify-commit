import { fetchCommits } from "./github";
import { generatePost } from "./ai";
import { buildPrompt } from "./prompt";
import type { Env, GenerateRequest } from "./types";
import {
  createLinkedInAuthorizationUrl,
  exchangeCode,
  getConnection,
  linkedinStorage,
  publishPost,
} from "./linkedin";

const DEFAULT_DAYS = 30;
const MAX_DAYS = 90;

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function getCorsHeaders(request: Request): Headers {
  const headers = new Headers({
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Origin": "*",
  });
  const origin = request.headers.get("Origin");
  if (origin) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}

function withCors(response: Response, request: Request): Response {
  const headers = new Headers(response.headers);
  getCorsHeaders(request).forEach((value, key) => headers.set(key, value));
  return new Response(response.body, { status: response.status, headers });
}

function validateRequest(body: unknown): Required<GenerateRequest> {
  if (!body || typeof body !== "object") throw new Error("Request body must be a JSON object");
  const input = body as Record<string, unknown>;
  const username = typeof input.username === "string" ? input.username.trim() : "";
  if (!username || !/^[A-Za-z0-9-]+$/.test(username)) throw new Error("username must be a valid GitHub username");
  const days = input.days === undefined ? DEFAULT_DAYS : Number(input.days);
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) throw new Error(`days must be an integer between 1 and ${MAX_DAYS}`);
  return { username, days };
}

function requirePublishAuthorization(request: Request, env: Env): void {
  if (!env.LINKEDIN_PUBLISH_TOKEN) throw new Error("LINKEDIN_PUBLISH_TOKEN is not configured");
  if (request.headers.get("Authorization") !== `Bearer ${env.LINKEDIN_PUBLISH_TOKEN}`) throw new Error("Unauthorized");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = (response: Response) => withCors(response, request);
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") return cors(json({ status: "ok", service: "postify-commit" }));

    if (request.method === "GET" && url.pathname === "/linkedin/auth") {
      try {
        const state = crypto.randomUUID();
        await env.LINKEDIN_KV.put(`${linkedinStorage.statePrefix}${state}`, "1", { expirationTtl: linkedinStorage.stateTtlSeconds });
        return Response.redirect(createLinkedInAuthorizationUrl(env, state), 302);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected error";
        return cors(json({ error: message }, 500));
      }
    }

    if (request.method === "GET" && url.pathname === "/linkedin/callback") {
      try {
        const error = url.searchParams.get("error");
        if (error) return cors(json({ error: `LinkedIn authorization denied: ${error}` }, 400));
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!code || !state) return cors(json({ error: "Missing OAuth code or state" }, 400));
        const stateKey = `${linkedinStorage.statePrefix}${state}`;
        const validState = await env.LINKEDIN_KV.get(stateKey);
        await env.LINKEDIN_KV.delete(stateKey);
        if (!validState) return cors(json({ error: "Invalid or expired OAuth state" }, 400));
        const connection = await exchangeCode(env, code);
        await env.LINKEDIN_KV.put(linkedinStorage.connectionKey, JSON.stringify(connection));
        return cors(json({ connected: true, name: connection.user.name ?? null, message: "LinkedIn account connected successfully." }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected error";
        return cors(json({ error: message }, 502));
      }
    }

    if (request.method === "GET" && url.pathname === "/linkedin/status") {
      const connection = await getConnection(env);
      return cors(json({ connected: Boolean(connection), name: connection?.user.name ?? null, expiresAt: connection?.expiresAt ?? null }));
    }

    if (request.method === "POST" && url.pathname === "/linkedin/publish") {
      try {
        requirePublishAuthorization(request, env);
        const body = await request.json<{ post?: unknown; confirm?: unknown }>();
        if (body.confirm !== true) return cors(json({ error: "Explicit confirmation is required to publish" }, 400));
        if (typeof body.post !== "string" || !body.post.trim()) return cors(json({ error: "post must be a non-empty string" }, 400));
        const postId = await publishPost(env, body.post.trim());
        return cors(json({ published: true, postId }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected error";
        const status = message === "Unauthorized" ? 401 : message.includes("not configured") ? 500 : message.includes("must be") || message.includes("not connected") || message.includes("reconnect") ? 400 : 502;
        return cors(json({ error: message }, status));
      }
    }

    if (request.method === "POST" && url.pathname === "/generate") {
      try {
        if (!env.GITHUB_TOKEN) return cors(json({ error: "GITHUB_TOKEN is not configured" }, 500));
        const body = validateRequest(await request.json());
        const commits = await fetchCommits(body.username, body.days, env.GITHUB_TOKEN);
        if (commits.length === 0) return cors(json({ post: null, commits: 0, message: `No commits found for ${body.username} in the last ${body.days} days.` }));
        const post = await generatePost(env, buildPrompt(body.username, commits));
        return cors(json({ post, commits: commits.length, days: body.days, username: body.username }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected error";
        const status = message.includes("Request body") || message.includes("username") || message.includes("days") ? 400 : 502;
        return cors(json({ error: message }, status));
      }
    }

    return cors(json({ error: "Not found" }, 404));
  },
} satisfies ExportedHandler<Env>;
