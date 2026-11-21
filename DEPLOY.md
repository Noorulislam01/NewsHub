# Deploy to Vercel

This project is a static HTML site with one Vercel Function for article summaries.

1. Import the GitHub repository `Noorulislam01/NewsHub` into Vercel.
2. Set the Framework Preset to **Other**. Leave the Build Command blank and use `.` as the Output Directory (or leave the Output Directory override off).
3. In **Project Settings > Environment Variables**, add `GEMINI_API_KEY` with your Google Gemini API key. Optionally set `GEMINI_MODEL` to choose a model; the default is configured in `api/summarize.mjs`.
4. Deploy the project.

The site and news feeds work without an AI key, but article summaries need `GEMINI_API_KEY` or `ANTHROPIC_API_KEY` configured in Vercel. Keep provider keys in Vercel environment variables; do not put them in `index.html`.

The summaries route is `/api/summarize`. The same handler is also exposed through the existing Netlify function and redirect, so Netlify deployments can continue using this repository.
