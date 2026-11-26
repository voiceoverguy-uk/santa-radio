import catalogueArtwork, { catalogueArtworkRoute } from '../server/catalogue-artwork.js';
import { mergeArtworkFeed, readArtworkOverrides } from '../server/catalogue-artwork-store.js';
import * as mapping from '../src/data/artistArtwork.js';
import { buildArtworkFeed, artworkFeedPath, artworkHeaders } from '../server/artwork-feed.js';
import { publicRequestUrl } from '../src/seo/requestUrl.js';

export default function artworkFeedPlugin() {
  return {
    name: 'shared-artist-artwork-feed',
    transformIndexHtml: {
      order: 'post',
      handler(_html, context) {
        if (context.path !== '/index.html' && context.path !== '/') return;
        return [{ tag:'script', attrs:{ nomodule:true, defer:true, src:'/assets/radio-catalogue.js' }, injectTo:'head-prepend' }];
      },
    },
    configureServer(server) {
      server.middlewares.use('/api/catalogue-artwork', catalogueArtwork);
      server.middlewares.use(artworkHeaders);
      server.middlewares.use(async (req, res, next) => {
        if (publicRequestUrl(req.url, 'http://server').pathname !== artworkFeedPath) return catalogueArtworkRoute(req, res, next);
        if (!['GET', 'HEAD'].includes(req.method)) {
          res.writeHead(405, { Allow: 'GET, HEAD, OPTIONS' }).end(); return;
        }
        try {
          // Vite invalidates this module when mappings change, so no restart or second list is needed.
          const liveMapping = await server.ssrLoadModule('/src/data/artistArtwork.js');
          const liveSongs = await server.ssrLoadModule('/src/data/songArtwork.js');
          const catalogue = await server.ssrLoadModule('/src/data/songs.json');
          const feed = await buildArtworkFeed(liveMapping, {
            recordingMapping: liveSongs.songPortraits,
            catalogue: catalogue.default,
          });
          const body = JSON.stringify(mergeArtworkFeed(feed, await readArtworkOverrides()), null, 2);
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
      server.middlewares.use('/api/catalogue-artwork', catalogueArtwork);
      server.middlewares.use(catalogueArtworkRoute);
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
