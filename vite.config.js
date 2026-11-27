import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import newsFeed from './api/news-feed.mjs';
import askNews from './api/ask-news.mjs';
import research from './api/research.mjs';

function localApiPlugin() {
  return {
    name: 'local-api-routes',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        let url;
        try {
          url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
        } catch {
          return next();
        }

        const route = url.pathname === '/api/news-feed'
          ? newsFeed
          : url.pathname === '/api/ask-news'
            ? askNews
            : url.pathname === '/api/research'
              ? research
            : null;
        if (!route) return next();

        try {
          const headers = new Headers();
          for (const [name, value] of Object.entries(req.headers)) {
            if (value) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
          }

          const method = req.method || 'GET';
          let body;
          if (method !== 'GET' && method !== 'HEAD') {
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            body = Buffer.concat(chunks);
          }
          const request = new Request(url, { method, headers, body: body?.length ? body : undefined });
          const response = await route.fetch(request);
          res.statusCode = response.status;
          response.headers.forEach((value, name) => res.setHeader(name, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (error) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end(error?.message || 'Local news feed request failed');
        }
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const localEnv = loadEnv(mode, process.cwd(), '');
  for (const [key, value] of Object.entries(localEnv)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  return {
    plugins: [react(), localApiPlugin()],
    build: { outDir: 'dist' }
  };
});
