import { describe, expect, it, vi } from "vitest";
import { fetchCommits } from "../src/github";

describe("fetchCommits", () => {
  it("queries GitHub and returns commit items", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          total_count: 1,
          incomplete_results: false,
          items: [
            {
              repository: { full_name: "YuzuruTK/example" },
              commit: {
                message: "feat: add worker",
                author: { date: "2026-08-26T12:00:00Z" },
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await fetchCommits("YuzuruTK", 30, "secret", fetchMock);

    expect(result).toHaveLength(1);
    expect(result[0]?.commit.message).toBe("feat: add worker");
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, options] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain("author%3AYuzuruTK");
    expect((options?.headers as Record<string, string>)["Authorization"]).toBe("Bearer secret");
  });

  it("throws when GitHub returns an error", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("rate limited", { status: 403 }),
    );

    await expect(fetchCommits("YuzuruTK", 30, "secret", fetchMock)).rejects.toThrow(
      "GitHub API returned 403",
    );
  });
});
