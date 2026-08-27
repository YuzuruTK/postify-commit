import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../src/types";

// Mock all three dependencies so we control GitHub, AI, and Telegram behaviour
vi.mock("../src/github", () => ({
  fetchCommits: vi.fn(),
}));
vi.mock("../src/ai", () => ({
  generatePost: vi.fn(),
}));
vi.mock("../src/telegram", () => ({
  sendTelegramMessage: vi.fn(),
}));

// Must import after mocks are set up
const { fetchCommits } = await import("../src/github");
const { generatePost } = await import("../src/ai");
const { sendTelegramMessage } = await import("../src/telegram");
const mod = await import("../src/worker");
const worker = mod.default;

const mockEnv = (
  overrides: Partial<Env> = {},
): Env & { AI: { run: ReturnType<typeof vi.fn> } } => ({
  AI: { run: vi.fn() },
  GITHUB_TOKEN: "gh_token",
  TELEGRAM_BOT_TOKEN: "bot_token",
  TELEGRAM_CHAT_ID: "chat_id",
  ...overrides,
}) as Env & { AI: { run: ReturnType<typeof vi.fn> } };

function request(method: string, url: string, body?: unknown): Request {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  return new Request(url, init);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("worker fetch", () => {
  describe("/health", () => {
    it("returns ok", async () => {
      const env = mockEnv();
      const res = await worker.fetch(request("GET", "http://test/health"), env);
      const data = await res.json<Record<string, unknown>>();
      expect(res.status).toBe(200);
      expect(data.status).toBe("ok");
    });
  });

  describe("/telegram/send", () => {
    it("sends a message and returns telegramSent: true", async () => {
      vi.mocked(sendTelegramMessage).mockResolvedValue(true);
      const env = mockEnv();
      const res = await worker.fetch(
        request("POST", "http://test/telegram/send", { message: "Hello" }),
        env,
      );
      const data = await res.json<{ telegramSent: boolean }>();
      expect(res.status).toBe(200);
      expect(data.telegramSent).toBe(true);
      expect(sendTelegramMessage).toHaveBeenCalledWith("Hello", env);
    });

    it("returns telegramSent: false when send fails", async () => {
      vi.mocked(sendTelegramMessage).mockResolvedValue(false);
      const env = mockEnv();
      const res = await worker.fetch(
        request("POST", "http://test/telegram/send", { message: "Hello" }),
        env,
      );
      const data = await res.json<{ telegramSent: boolean }>();
      expect(res.status).toBe(200);
      expect(data.telegramSent).toBe(false);
    });

    it("returns 400 when message is missing", async () => {
      const env = mockEnv();
      const res = await worker.fetch(
        request("POST", "http://test/telegram/send", {}),
        env,
      );
      const data = await res.json<{ error: string }>();
      expect(res.status).toBe(400);
      expect(data.error).toContain("message");
    });

    it("returns 500 when Telegram secrets are missing", async () => {
      const env = mockEnv({ TELEGRAM_BOT_TOKEN: "", TELEGRAM_CHAT_ID: "" });
      const res = await worker.fetch(
        request("POST", "http://test/telegram/send", { message: "Hello" }),
        env,
      );
      const data = await res.json<{ error: string }>();
      expect(res.status).toBe(500);
      expect(data.error).toContain("Telegram is not configured");
    });
  });

  describe("/generate", () => {
    const commits = [
      {
        repository: { full_name: "user/repo" },
        commit: {
          message: "fix: bug",
          author: { date: "2026-08-26T12:00:00Z" },
        },
      },
    ];

    it("generates a post without Telegram when sendToTelegram is not set", async () => {
      vi.mocked(fetchCommits).mockResolvedValue(commits);
      vi.mocked(generatePost).mockResolvedValue("Generated post content");
      const env = mockEnv();
      const res = await worker.fetch(
        request("POST", "http://test/generate", { username: "YuzuruTK" }),
        env,
      );
      const data = await res.json<Record<string, unknown>>();
      expect(res.status).toBe(200);
      expect(data.post).toBe("Generated post content");
      expect(data.telegramSent).toBe(false);
      expect(sendTelegramMessage).not.toHaveBeenCalled();
    });

    it("generates a post and sends to Telegram when sendToTelegram is true", async () => {
      vi.mocked(fetchCommits).mockResolvedValue(commits);
      vi.mocked(generatePost).mockResolvedValue("Generated post content");
      vi.mocked(sendTelegramMessage).mockResolvedValue(true);
      const env = mockEnv();
      const res = await worker.fetch(
        request("POST", "http://test/generate", {
          username: "YuzuruTK",
          sendToTelegram: true,
        }),
        env,
      );
      const data = await res.json<Record<string, unknown>>();
      expect(res.status).toBe(200);
      expect(data.post).toBe("Generated post content");
      expect(data.telegramSent).toBe(true);
      expect(sendTelegramMessage).toHaveBeenCalledWith("Generated post content", env);
    });

    it("returns post with telegramSent: false when Telegram is unavailable", async () => {
      vi.mocked(fetchCommits).mockResolvedValue(commits);
      vi.mocked(generatePost).mockResolvedValue("Generated post content");
      vi.mocked(sendTelegramMessage).mockResolvedValue(false);
      const env = mockEnv();
      const res = await worker.fetch(
        request("POST", "http://test/generate", {
          username: "YuzuruTK",
          sendToTelegram: true,
        }),
        env,
      );
      const data = await res.json<Record<string, unknown>>();
      expect(res.status).toBe(200);
      expect(data.post).toBe("Generated post content");
      expect(data.telegramSent).toBe(false);
      expect(sendTelegramMessage).toHaveBeenCalled();
    });
  });

  describe("OPTIONS", () => {
    it("returns 204 with CORS headers", async () => {
      const env = mockEnv();
      const res = await worker.fetch(
        new Request("http://test/generate", { method: "OPTIONS" }),
        env,
      );
      expect(res.status).toBe(204);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });

  describe("404", () => {
    it("returns 404 for unknown routes", async () => {
      const env = mockEnv();
      const res = await worker.fetch(
        request("GET", "http://test/unknown"),
        env,
      );
      expect(res.status).toBe(404);
    });
  });
});
