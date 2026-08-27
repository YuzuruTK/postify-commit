export interface Env {
  AI: Ai;
  GITHUB_TOKEN: string;
  LINKEDIN_KV: KVNamespace;
  LINKEDIN_CLIENT_ID?: string;
  LINKEDIN_CLIENT_SECRET?: string;
  LINKEDIN_REDIRECT_URI?: string;
}

export interface GenerateRequest {
  username: string;
  days?: number;
}

export interface LinkedInUser {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?: string;
  email?: string;
  email_verified?: boolean;
}

export interface LinkedInConnection {
  accessToken: string;
  expiresAt: number;
  refreshToken?: string;
  refreshTokenExpiresAt?: number;
  user: LinkedInUser;
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
