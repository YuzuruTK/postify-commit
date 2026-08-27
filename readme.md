# Postify Commit

Postify Commit analyzes GitHub commits from a configurable time period and generates a professional LinkedIn post in Portuguese using AI.

The repository includes a **Cloudflare Worker API** backed by Cloudflare Workers AI. The original Python CLI is kept for local use and backwards compatibility. The Worker can also connect to a LinkedIn member account through OAuth 2.0 and publish a generated text post after explicit confirmation.

## Features

- Fetches commits from GitHub for a specified time period
- Generates AI-powered summaries optimized for LinkedIn
- Uses Cloudflare Workers AI in the Worker deployment
- HTTP API with health, generation, LinkedIn OAuth, status, and publishing endpoints
- LinkedIn member authorization through OAuth 2.0
- Publishes text-only posts through the LinkedIn Posts API
- Keeps the existing Python CLI available
- Avoids inventing technologies, features, results, or learnings not supported by commit messages

## Cloudflare Worker

### Prerequisites

- Node.js 18+
- A Cloudflare account with Workers AI enabled
- A GitHub account and Personal Access Token
- A LinkedIn Developer application with **Share on LinkedIn** enabled
- A Cloudflare KV namespace for the LinkedIn OAuth connection/state

### Install

```bash
npm install
```

### Configure secrets

For local development, create a `.dev.vars` file:

```text
GITHUB_TOKEN=github_pat_your_token_here
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
LINKEDIN_REDIRECT_URI=http://localhost:8787/linkedin/callback
LINKEDIN_PUBLISH_TOKEN=choose_a_long_random_secret
```

For a deployed Worker, configure secrets with Wrangler:

```bash
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put LINKEDIN_CLIENT_ID
npx wrangler secret put LINKEDIN_CLIENT_SECRET
npx wrangler secret put LINKEDIN_REDIRECT_URI
npx wrangler secret put LINKEDIN_PUBLISH_TOKEN
```

`LINKEDIN_PUBLISH_TOKEN` protects the publication endpoint. Clients must send it as `Authorization: Bearer <token>` and also provide `confirm: true` in the request body.

The Workers AI binding is configured through `wrangler.jsonc` as `env.AI`.

Before deploying, replace `REPLACE_WITH_CLOUDFLARE_KV_NAMESPACE_ID` in `wrangler.jsonc` with the ID of your KV namespace. Create one with:

```bash
npx wrangler kv namespace create LINKEDIN_KV
```

The same namespace must be used by the deployed Worker. KV stores the LinkedIn OAuth connection and short-lived OAuth state. The application does not log tokens.

### LinkedIn Developer configuration

Create an application in the LinkedIn Developer Portal and enable **Sign In with LinkedIn using OpenID Connect** and **Share on LinkedIn**. The Worker requests these scopes:

```text
openid profile w_member_social
```

Configure the exact OAuth redirect URI to match `LINKEDIN_REDIRECT_URI`, for example:

```text
https://your-worker.example.workers.dev/linkedin/callback
```

LinkedIn's current member authorization uses OAuth 2.0 and `w_member_social` permits posting on behalf of an authenticated member. The Worker uses the current `/rest/posts` endpoint with the required `Linkedin-Version` and `X-Restli-Protocol-Version` headers.

### LinkedIn endpoints

```text
GET  /linkedin/auth
GET  /linkedin/callback
GET  /linkedin/status
POST /linkedin/publish
```

Start the connection flow by opening `/linkedin/auth` in a browser. The Worker generates a one-time OAuth `state`, stores it in KV for 10 minutes, and redirects to LinkedIn.

After authorization, the callback exchanges the code for an access token, retrieves the authorized member through LinkedIn OpenID Connect, and stores the connection in KV. If LinkedIn supplies a refresh token, it is stored and used when the access token is close to expiration.

Check connection status:

```bash
curl http://localhost:8787/linkedin/status
```

Publish only with explicit confirmation and the publication token:

```bash
curl -X POST http://localhost:8787/linkedin/publish \
  -H 'Authorization: Bearer YOUR_LINKEDIN_PUBLISH_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"post":"Meu post gerado...","confirm":true}'
```

The API rejects publication unless the authorization token is valid and `confirm` is exactly `true`.

### Run locally

```bash
npm run dev
```

The Worker exposes:

```text
GET  /health
POST /generate
GET  /linkedin/auth
GET  /linkedin/callback
GET  /linkedin/status
POST /linkedin/publish
```

Generate a LinkedIn post with the default 30-day period:

```bash
curl -X POST http://localhost:8787/generate \
  -H 'Content-Type: application/json' \
  -d '{"username":"YuzuruTK"}'
```

Or specify a period from 1 to 90 days:

```bash
curl -X POST http://localhost:8787/generate \
  -H 'Content-Type: application/json' \
  -d '{"username":"YuzuruTK","days":14}'
```

A successful response has this shape:

```json
{
  "post": "...",
  "commits": 12,
  "days": 30,
  "username": "YuzuruTK"
}
```

If no commits are found, the API returns `post: null` with a descriptive message instead of calling the AI model.

### Deploy

```bash
npm run typecheck
npm test
npm run deploy
```

The Worker uses `@cf/meta/llama-3.3-70b-instruct-fp8-fast` through the Cloudflare Workers AI binding.

## Original Python CLI

The original local CLI remains available.

### Prerequisites

- Python 3.10 or higher
- A GitHub account
- A Groq AI API account

### Installation

```bash
python -m venv venv
```

**Windows:**

```bash
venv\\Scripts\\activate
```

**macOS/Linux:**

```bash
source venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Configure `.env` using `.env.example`:

```text
GITHUB_USERNAME=your_github_username
GITHUB_TOKEN=ghp_your_github_token_here
AI_API_KEY=gsk_your_groq_api_key_here
```

Run:

```bash
python postify_commit.py
```

## Security Notes

- Never commit `.env` or `.dev.vars` to version control.
- Store production credentials as Cloudflare Worker secrets.
- Keep GitHub and LinkedIn credentials private.
- The OAuth state is one-time and expires after 10 minutes.
- Publication requires both authentication and explicit confirmation.
- Publication is never triggered automatically by `/generate`.

## Development

Type-check the Worker:

```bash
npm run typecheck
```

Run tests:

```bash
npm test
```

## License

This project is open source and available for personal and commercial use.
