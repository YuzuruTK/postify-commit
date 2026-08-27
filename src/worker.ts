import { fetchCommits } from "./github";
import { generatePost } from "./ai";
import { buildPrompt } from "./prompt";
import { sendTelegramMessage } from "./telegram";
import type { Env, GenerateRequest } from "./types";

const DEFAULT_DAYS = 7;
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
  getCorsHeaders(request).forEach((value, key) => headers.set(key, value));
  return new Response(response.body, { status: response.status, headers });
}

function validateRequest(body: unknown): Required<GenerateRequest> & { sendToTelegram: boolean } {
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

  const sendToTelegram = input.sendToTelegram === true;

  return { username, days, sendToTelegram };
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

    if (request.method === "POST" && url.pathname === "/telegram/send") {
      try {
        if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
          return cors(json({ error: "Telegram is not configured" }, 500));
        }

        const raw = await request.json();
        if (!raw || typeof raw !== "object") {
          return cors(json({ error: "Request body must be a JSON object" }, 400));
        }

        const input = raw as Record<string, unknown>;
        if (typeof input.message !== "string" || input.message.trim() === "") {
          return cors(json({ error: "message must be a non-empty string" }, 400));
        }

        const sent = await sendTelegramMessage(input.message, env);
        return cors(json({ telegramSent: sent }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected error";
        return cors(json({ error: message }, 502));
      }
    }

    if (request.method === "POST" && url.pathname === "/generate") {
      try {
        if (!env.GITHUB_TOKEN) {
          return cors(json({ error: "GITHUB_TOKEN is not configured" }, 500));
        }

        const body = validateRequest(await request.json());
        const commits = await fetchCommits(body.username, body.days, env.GITHUB_TOKEN);

        if (commits.length === 0) {
          return cors(json({
            post: null,
            commits: 0,
            message: `No commits found for ${body.username} in the last ${body.days} days.`,
          }));
        }

        const prompt = buildPrompt(body.username, commits);
        const post = await generatePost(env, prompt);

        let telegramSent = false;
        if (body.sendToTelegram) {
          telegramSent = await sendTelegramMessage(post, env);
        }

        return cors(json({
          post,
          commits: commits.length,
          days: body.days,
          username: body.username,
          telegramSent,
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
