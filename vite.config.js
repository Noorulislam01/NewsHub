import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import newsFeed from './api/news-feed.mjs';

function localApiPlugin() {
  return {
    name: 'local-news-feed-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        let url;
        try {
          url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
        } catch {
          return next();
        }

        if (url.pathname !== '/api/news-feed') return next();

        try {
          const headers = new Headers();
          for (const [name, value] of Object.entries(req.headers)) {
            if (value) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
          }

          const request = new Request(url, { method: req.method || 'GET', headers });
          const response = await newsFeed.fetch(request);
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

export default defineConfig({
  plugins: [react(), localApiPlugin()],
  build: { outDir: 'dist' }
});
