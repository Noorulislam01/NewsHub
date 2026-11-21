# Deploy to Vercel

This project is a static HTML site with Vercel Functions for article summaries and the MEA feed proxy.

1. Import the GitHub repository `Noorulislam01/NewsHub` into Vercel.
2. Set the Framework Preset to **Other**. Leave the Build Command blank and use `.` as the Output Directory (or leave the Output Directory override off).
3. In **Project Settings > Environment Variables**, add `GEMINI_API_KEY` with your Google Gemini API key. Optionally set `GEMINI_MODEL` to choose the primary model and `GEMINI_FALLBACK_MODEL` to choose the fallback model; defaults are configured in `api/summarize.mjs`.
4. Deploy the project.

The site and news feeds work without an AI key, but article summaries need `GEMINI_API_KEY` or `ANTHROPIC_API_KEY` configured in Vercel. Keep provider keys in Vercel environment variables; do not put them in `index.html`.

The summaries route is `/api/summarize`. The MEA feed proxy is `/api/feed`; it only accepts MEA and Google News feed hosts. Both handlers are also exposed through Netlify functions and redirects, so Netlify deployments can continue using this repository.
