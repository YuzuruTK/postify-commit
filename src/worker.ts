import { fetchCommits } from "./github";
import { generatePost } from "./ai";
import { buildPrompt } from "./prompt";
import type { Env, GenerateRequest } from "./types";

const DEFAULT_DAYS = 30;
const MAX_DAYS = 90;

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function getCorsHeaders(request: Request): Headers {
  const headers = new Headers({
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Origin": "*",
  });

  const origin = request.headers.get("Origin");
  if (origin) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}

function withCors(response: Response, request: Request): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of getCorsHeaders(request)) headers.set(key, value);
  return new Response(response.body, { status: response.status, headers });
}

function validateRequest(body: unknown): GenerateRequest {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a JSON object");
  }

  const input = body as Record<string, unknown>;
  const username = typeof input.username === "string" ? input.username.trim() : "";
  if (!username || !/^[A-Za-z0-9-]+$/.test(username)) {
    throw new Error("username must be a valid GitHub username");
  }

  const days = input.days === undefined ? DEFAULT_DAYS : Number(input.days);
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
    throw new Error(`days must be an integer between 1 and ${MAX_DAYS}`);
  }

  return { username, days };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = (response: Response) => withCors(response, request);

    if (request.method === "OPTIONS") {
      return cors(new Response(null, { status: 204 }));
    }

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return cors(json({ status: "ok", service: "postify-commit" }));
    }

    if (request.method === "POST" && url.pathname === "/generate") {
      try {
        if (!env.GITHUB_TOKEN) {
          return cors(json({ error: "GITHUB_TOKEN is not configured" }, 500));
        }

        const body = validateRequest(await request.json());
        const commits = await fetchCommits(body.username, body.days ?? DEFAULT_DAYS, env.GITHUB_TOKEN);

        if (commits.length === 0) {
          return cors(json({
            post: null,
            commits: 0,
            message: `No commits found for ${body.username} in the last ${body.days ?? DEFAULT_DAYS} days.`,
          }));
        }

        const prompt = buildPrompt(body.username, commits);
        const post = await generatePost(env, prompt);

        return cors(json({
          post,
          commits: commits.length,
          days: body.days ?? DEFAULT_DAYS,
          username: body.username,
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected error";
        const status = message.includes("Request body") || message.includes("username") || message.includes("days")
          ? 400
          : 502;
        return cors(json({ error: message }, status));
      }
    }

    return cors(json({ error: "Not found" }, 404));
  },
} satisfies ExportedHandler<Env>;
