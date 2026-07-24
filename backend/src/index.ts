import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { env } from './env.js';
import './db.js'; // initializes + seeds on boot

const app = createApp();

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`MuulRoute backend v1.1 listening on http://localhost:${info.port}`);
});
