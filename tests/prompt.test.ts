import { describe, expect, it } from "vitest";
import { buildPrompt } from "../src/prompt";

describe("buildPrompt", () => {
  it("includes commit evidence and anti-hallucination rules", () => {
    const prompt = buildPrompt("YuzuruTK", [
      {
        repository: { full_name: "YuzuruTK/postify-commit" },
        commit: {
          message: "feat: migrate API to Cloudflare Worker",
          author: { date: "2026-08-26T12:00:00Z" },
        },
      },
    ]);

    expect(prompt).toContain("YuzuruTK/postify-commit - feat: migrate API to Cloudflare Worker");
    expect(prompt).toContain("Do not invent technologies, features, bugs, results");
    expect(prompt).toContain("in Portuguese");
  });
});
