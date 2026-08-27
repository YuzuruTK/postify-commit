export interface Env {
  AI: Ai;
  GITHUB_TOKEN: string;
}

export interface GenerateRequest {
  username: string;
  days?: number;
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
