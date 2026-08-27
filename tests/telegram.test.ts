import { describe, expect, it, vi } from "vitest";
import { sendTelegramMessage } from "../src/telegram";
import type { Env } from "../src/types";

const mockEnv = (overrides: Partial<Env> = {}): Env => ({
  AI: {} as Ai,
  GITHUB_TOKEN: "gh_token",
  TELEGRAM_BOT_TOKEN: "123456:ABC-DEF",
  TELEGRAM_CHAT_ID: "987654",
  ...overrides,
});

describe("sendTelegramMessage", () => {
  it("sends a message successfully", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    const result = await sendTelegramMessage("Hello", mockEnv(), fetchMock);

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("returns false on HTTP 401", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("Unauthorized", { status: 401 }),
    );

    const result = await sendTelegramMessage("Hello", mockEnv(), fetchMock);

    expect(result).toBe(false);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("returns false on HTTP 403", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("Forbidden", { status: 403 }),
    );

    const result = await sendTelegramMessage("Hello", mockEnv(), fetchMock);

    expect(result).toBe(false);
  });

  it("returns false on HTTP 500", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("Internal Server Error", { status: 500 }),
    );

    const result = await sendTelegramMessage("Hello", mockEnv(), fetchMock);

    expect(result).toBe(false);
  });

  it("returns false when Telegram responds with ok: false", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ ok: false, description: "Chat not found" }),
        { status: 200 },
      ),
    );

    const result = await sendTelegramMessage("Hello", mockEnv(), fetchMock);

    expect(result).toBe(false);
  });

  it("returns false when TELEGRAM_BOT_TOKEN is missing", async () => {
    const fetchMock = vi.fn<typeof fetch>();

    const result = await sendTelegramMessage(
      "Hello",
      mockEnv({ TELEGRAM_BOT_TOKEN: "" }),
      fetchMock,
    );

    expect(result).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns false when TELEGRAM_CHAT_ID is missing", async () => {
    const fetchMock = vi.fn<typeof fetch>();

    const result = await sendTelegramMessage(
      "Hello",
      mockEnv({ TELEGRAM_CHAT_ID: "" }),
      fetchMock,
    );

    expect(result).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls the correct URL containing the bot token", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await sendTelegramMessage("Hello", mockEnv(), fetchMock);

    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain("bot123456:ABC-DEF");
    expect(String(url)).toContain("/sendMessage");
  });

  it("sends the correct payload", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await sendTelegramMessage("Test message", mockEnv(), fetchMock);

    const [, options] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String(options?.body ?? "{}"));
    expect(body.chat_id).toBe("987654");
    expect(body.text).toBe("Test message");
  });
});