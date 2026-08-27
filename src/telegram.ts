import type { Env, TelegramApiResponse } from "./types";

const TELEGRAM_API = "https://api.telegram.org";
const MAX_MESSAGE_LENGTH = 4096;

export async function sendTelegramMessage(
  message: string,
  env: Env,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    console.error(
      "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not configured",
    );
    return false;
  }

  const truncated = message.slice(0, MAX_MESSAGE_LENGTH);
  const url = `${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: truncated,
      }),
    });

    if (!response.ok) {
      console.error(
        `Telegram API returned HTTP ${response.status}: ${await response.text()}`,
      );
      return false;
    }

    const data = (await response.json()) as TelegramApiResponse;

    if (!data.ok) {
      console.error(
        `Telegram API responded with ok: false — ${data.description ?? "no description"}`,
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error("Telegram API request failed:", error);
    return false;
  }
}