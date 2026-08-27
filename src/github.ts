import type { GitHubCommit, GitHubSearchResponse } from "./types";

const GITHUB_API = "https://api.github.com";

export async function fetchCommits(
  username: string,
  days: number,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GitHubCommit[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const query = `author:${username} committer-date:>=${since}`;
  const url = `${GITHUB_API}/search/commits?q=${encodeURIComponent(query)}&per_page=100`;

  const response = await fetchImpl(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "postify-commit-worker",
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub API returned ${response.status}: ${detail}`);
  }

  const data = (await response.json()) as GitHubSearchResponse;
  return data.items ?? [];
}
