# Postify Commit

Postify Commit analyzes GitHub commits from a configurable time period and generates a professional LinkedIn post in Portuguese using AI.

The repository now includes a **Cloudflare Worker API** backed by Cloudflare Workers AI. The original Python CLI is kept for local use and backwards compatibility.

## Features

- Fetches commits from GitHub for a specified time period
- Generates AI-powered summaries optimized for LinkedIn
- Uses Cloudflare Workers AI in the Worker deployment
- HTTP API with health and generation endpoints
- Keeps the existing Python CLI available
- Avoids inventing technologies, features, results, or learnings not supported by commit messages

## Cloudflare Worker

### Prerequisites

- Node.js 18+
- A Cloudflare account with Workers AI enabled
- A GitHub account
- A GitHub Personal Access Token with access to the repositories whose commits should be analyzed

### Install

```bash
npm install
```

### Configure GitHub secret

For local development, create a `.dev.vars` file:

```text
GITHUB_TOKEN=github_pat_your_token_here
```

For a deployed Worker, configure the secret with Wrangler:

```bash
npx wrangler secret put GITHUB_TOKEN
```

The Workers AI binding is configured automatically through `wrangler.jsonc` as `env.AI`.

### Run locally

```bash
npm run dev
```

The Worker exposes:

```text
GET  /health
POST /generate
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
- Keep GitHub tokens and AI credentials private.

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
