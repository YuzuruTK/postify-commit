import { describe, expect, it } from "vitest";
import { createLinkedInAuthorizationUrl } from "../src/linkedin";

const env = {
  LINKEDIN_CLIENT_ID: "client-id",
  LINKEDIN_REDIRECT_URI: "https://example.com/linkedin/callback",
} as any;

describe("LinkedIn OAuth", () => {
  it("builds an authorization URL with the required scopes", () => {
    const url = new URL(createLinkedInAuthorizationUrl(env, "state-123"));

    expect(url.origin).toBe("https://www.linkedin.com");
    expect(url.pathname).toBe("/oauth/v2/authorization");
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("redirect_uri")).toBe("https://example.com/linkedin/callback");
    expect(url.searchParams.get("state")).toBe("state-123");
    expect(url.searchParams.get("scope")).toBe("openid profile w_member_social");
  });
});
