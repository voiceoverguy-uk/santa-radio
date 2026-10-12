import express from 'express';
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from '../../server/middlewares/clerkProxyMiddleware.js';
const app = express();
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use((_req, res) => res.status(404).end());
export default app;
