import { Hono } from 'hono';
import { db } from '../db.js';
import { fail, ok, requireAuth, requireRole } from '../http.js';

export const analyticsRoutes = new Hono();
analyticsRoutes.use('*', requireAuth);

// Assumed operating cost per completed delivery (INR) for cost analytics.
const COST_PER_DELIVERY_INR = 45;

analyticsRoutes.get('/dashboard', (c) => {
  const activeDrivers = (
    db
      .prepare(
        `SELECT COUNT(DISTINCT assigned_driver_id) AS c FROM deliveries
         WHERE status IN ('driver_accepted','picked_up','in_transit','near_destination')`
      )
      .get() as { c: number }
  ).c;

  const deliveriesToday = (
    db.prepare("SELECT COUNT(*) AS c FROM deliveries WHERE date(created_at) = date('now')").get() as {
      c: number;
    }
  ).c;

  const completed = (
    db
      .prepare("SELECT COUNT(*) AS c FROM deliveries WHERE status = 'delivered' AND date(completed_at) = date('now')")
      .get() as { c: number }
  ).c;

  const avgMinutes = (
    db
      .prepare(
        `SELECT AVG((julianday(completed_at) - julianday(COALESCE(started_at, accepted_at, created_at))) * 1440.0) AS m
         FROM deliveries WHERE status = 'delivered' AND date(completed_at) = date('now')`
      )
      .get() as { m: number | null }
  ).m;

  const onTime = db
    .prepare(
      `SELECT
         SUM(CASE WHEN deadline IS NULL OR completed_at <= deadline THEN 1 ELSE 0 END) AS on_time,
         COUNT(*) AS total
       FROM deliveries WHERE status = 'delivered' AND date(completed_at) = date('now')`
    )
    .get() as { on_time: number | null; total: number };

  const revenueToday = (
    db
      .prepare(
        "SELECT COALESCE(SUM(cod_amount),0) AS r FROM deliveries WHERE status = 'delivered' AND date(completed_at) = date('now')"
      )
      .get() as { r: number }
  ).r;

  const byStatus = db
    .prepare('SELECT status, COUNT(*) AS count FROM deliveries GROUP BY status')
    .all();

  return ok(c, {
    activeDrivers,
    deliveriesToday,
    completed,
    avgMinutes: avgMinutes == null ? 0 : Math.round(avgMinutes * 10) / 10,
    onTimeRate: onTime.total ? Math.round(((onTime.on_time ?? 0) / onTime.total) * 1000) / 10 : 100,
    revenueToday,
    costPerDelivery: completed > 0 ? COST_PER_DELIVERY_INR : 0,
    byStatus,
  });
});

analyticsRoutes.get('/drivers', (c) => {
  const rows = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.tier,
         COUNT(d.id) AS assigned,
         SUM(CASE WHEN d.status = 'delivered' THEN 1 ELSE 0 END) AS completed,
         SUM(CASE WHEN d.status = 'failed' THEN 1 ELSE 0 END) AS failed,
         SUM(CASE WHEN d.status IN ('driver_accepted','picked_up','in_transit','near_destination') THEN 1 ELSE 0 END) AS active,
         COALESCE(SUM(CASE WHEN d.status = 'delivered' THEN d.cod_amount ELSE 0 END), 0) AS revenue,
         AVG(CASE WHEN d.status = 'delivered'
             THEN (julianday(d.completed_at) - julianday(COALESCE(d.started_at, d.accepted_at, d.created_at))) * 1440.0
             END) AS avg_minutes,
         SUM(CASE WHEN d.accepted_at IS NOT NULL AND date(d.accepted_at) = date('now') THEN 1 ELSE 0 END) AS accepted_today
       FROM users u
       LEFT JOIN deliveries d ON d.assigned_driver_id = u.id
       WHERE u.role = 'driver'
       GROUP BY u.id
       ORDER BY completed DESC`
    )
    .all();
  return ok(c, rows);
});

analyticsRoutes.get('/regions/:id', requireRole('admin', 'dispatcher'), (c) => {
  const region = db.prepare('SELECT * FROM regions WHERE id = ?').get(c.req.param('id')) as
    | { id: string; name: string; version: number; bounds: string }
    | undefined;
  if (!region) return fail(c, 'Region not found', 404);
  const [minLat, minLon, maxLat, maxLon] = JSON.parse(region.bounds) as number[];
  const byStatus = db
    .prepare(
      `SELECT status, COUNT(*) AS count FROM deliveries
       WHERE dropoff_lat BETWEEN ? AND ? AND dropoff_lon BETWEEN ? AND ?
       GROUP BY status`
    )
    .all(minLat, maxLat, minLon, maxLon);
  const totals = db
    .prepare(
      `SELECT COUNT(*) AS deliveries,
              COALESCE(SUM(CASE WHEN status = 'delivered' THEN cod_amount ELSE 0 END), 0) AS revenue
       FROM deliveries
       WHERE dropoff_lat BETWEEN ? AND ? AND dropoff_lon BETWEEN ? AND ?`
    )
    .get(minLat, maxLat, minLon, maxLon);
  return ok(c, {
    region: { ...region, bounds: JSON.parse(region.bounds) },
    byStatus,
    totals,
  });
});
