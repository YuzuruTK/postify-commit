import type { Env } from "./types";

export const AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

interface AiResponse {
  response?: string;
}

export async function generatePost(env: Env, prompt: string): Promise<string> {
  const result = (await env.AI.run(AI_MODEL, {
    messages: [
      {
        role: "system",
        content:
          "You write concise, factual professional LinkedIn posts for software developers.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.4,
    max_tokens: 1200,
  })) as AiResponse;

  const post = result.response?.trim();
  if (!post) {
    throw new Error("Workers AI returned an empty response");
  }

  return post;
}
