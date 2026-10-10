import * as mapping from '../src/data/artistArtwork.js';
import { buildArtworkFeed, artworkFeedPath, artworkHeaders } from '../server/artwork-feed.js';

export default function artworkFeedPlugin() {
  return {
    name: 'shared-artist-artwork-feed',
    configureServer(server) {
      server.middlewares.use(artworkHeaders);
      server.middlewares.use(async (req, res, next) => {
        if (new URL(req.url, 'http://server').pathname !== artworkFeedPath) { next(); return; }
        if (!['GET', 'HEAD'].includes(req.method)) {
          res.writeHead(405, { Allow: 'GET, HEAD, OPTIONS' }).end(); return;
        }
        try {
          // Vite invalidates this module when mappings change, so no restart or second list is needed.
          const liveMapping = await server.ssrLoadModule('/src/data/artistArtwork.js');
          const feed = await buildArtworkFeed(liveMapping);
          const body = JSON.stringify(feed, null, 2);
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'X-Content-Type-Options': 'nosniff',
            'Content-Length': Buffer.byteLength(body),
          });
          res.end(req.method === 'HEAD' ? undefined : body);
        } catch (error) { next(error); }
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use(artworkHeaders);
    },
    async generateBundle() {
      const feed = await buildArtworkFeed(mapping);
      this.emitFile({
        type: 'asset',
        fileName: artworkFeedPath.slice(1),
        source: JSON.stringify(feed, null, 2),
      });
    },
  };
}
