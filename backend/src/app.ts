import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authRoutes } from './routes/auth.js';
import { deliveriesRoutes } from './routes/deliveries.js';
import { geocodeRoutes } from './routes/geocode.js';
import { regionsRoutes } from './routes/regions.js';
import { integrationsRoutes } from './routes/integrations.js';
import { feedbackRoutes } from './routes/feedback.js';
import { analyticsRoutes } from './routes/analytics.js';
import { notificationsRoutes } from './routes/notifications.js';

export function createApp() {
  const app = new Hono();

  app.use(
    '*',
    cors({
      origin: ['http://localhost:3000', 'http://localhost:4011', 'http://localhost:4012'],
      credentials: true,
      allowHeaders: ['Content-Type', 'Authorization', 'X-MoInvoice-Key'],
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    })
  );

  app.onError((err, c) => {
    const status = (err as { status?: number }).status ?? 500;
    if (status >= 500) console.error('[error]', err);
    return c.json({ success: false, error: err.message || 'Internal Server Error' }, status as never);
  });

  app.notFound((c) => c.json({ success: false, error: 'Not found' }, 404));

  app.get('/api/v1/health', (c) => c.json({ success: true, data: { status: 'ok', version: '1.1' } }));

  app.route('/api/v1/auth', authRoutes);
  app.route('/api/v1/deliveries', deliveriesRoutes);
  app.route('/api/v1/geocode', geocodeRoutes);
  app.route('/api/v1/regions', regionsRoutes);
  app.route('/api/v1/integrations', integrationsRoutes);
  app.route('/api/v1/feedback', feedbackRoutes);
  app.route('/api/v1/analytics', analyticsRoutes);
  app.route('/api/v1/notifications', notificationsRoutes);

  return app;
}
