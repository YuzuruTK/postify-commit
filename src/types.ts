export interface Env {
  AI: Ai;
  GITHUB_TOKEN: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
}

export interface GenerateRequest {
  username: string;
  days?: number;
  sendToTelegram?: boolean;
}

export interface GitHubCommit {
  repository: {
    full_name: string;
  };
  commit: {
    message: string;
    author: {
      date: string;
    } | null;
  };
}

export interface GitHubSearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubCommit[];
}

export interface TelegramSendRequest {
  message: string;
}

export interface TelegramApiResponse {
  ok: boolean;
  description?: string;
}
