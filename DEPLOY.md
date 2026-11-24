# One News Hub

One News Hub is being migrated incrementally to React with Vite. The existing visual design, RSS feed behavior, saved stories, summaries, filters, theme controls, and PWA support are being preserved during the migration.

## Local development

Use Node.js 20 or newer and npm.

```sh
npm install
npm run dev
```

This starts the Vite UI preview at `http://localhost:5173`. The summary API is a Vercel Function, so use `npm run dev:vercel` for local summaries. Link the checkout to the Vercel project first if prompted, then pull the project’s development environment variables when the local function needs the Gemini key. Keep keys in local environment files or Vercel; never commit them.

## Production build

```sh
npm run build
```

Vite writes the deployable site to `dist/`. The Vercel configuration uses that directory and keeps the summary function in `api/`. The thin Netlify adapter lives in `adapters/netlify/` and calls the same shared summary handler.

## Deploying

- **Vercel:** Framework preset **Other**, build command `npm run build`, output directory `dist`. Configure `GEMINI_API_KEY` (and optional `GEMINI_MODEL` / `GEMINI_FALLBACK_MODEL`) for the serverless summary function.
- **Netlify:** use the repository’s `netlify.toml`; configure the same server-side AI environment variables if summaries are needed.

Do not commit `.env` files or API keys.
