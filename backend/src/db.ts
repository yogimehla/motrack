import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { env } from './env.js';
import { encode as plusEncode } from './util/pluscode.js';

fs.mkdirSync(path.dirname(env.DB_PATH), { recursive: true });

export const db = new Database(env.DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','dispatcher','driver')),
  tier TEXT NOT NULL DEFAULT 'free' CHECK(tier IN ('free','pro')),
  phone TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS regions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  bounds TEXT NOT NULL, -- JSON [minLat,minLon,maxLat,maxLon]
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pickup_address TEXT NOT NULL,
  pickup_lat REAL NOT NULL,
  pickup_lon REAL NOT NULL,
  pickup_plus_code TEXT,
  dropoff_address TEXT NOT NULL,
  dropoff_lat REAL NOT NULL,
  dropoff_lon REAL NOT NULL,
  dropoff_plus_code TEXT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  cod_amount REAL,
  weight_kg REAL NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 5,
  deadline TEXT,
  time_window TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN
    ('pending','assigned','driver_accepted','picked_up','in_transit','near_destination','delivered','failed','returned')),
  assigned_driver_id INTEGER REFERENCES users(id),
  pod TEXT, -- JSON {signature_svg?, photo_base64?, notes?, otp?, location?}
  fail_reason TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  external_order_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  accepted_at TEXT,
  started_at TEXT,
  completed_at TEXT
);
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  delivery_id INTEGER REFERENCES deliveries(id),
  user_id INTEGER REFERENCES users(id),
  type TEXT NOT NULL CHECK(type IN ('like','dislike','rating')),
  rating INTEGER,
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id), -- NULL = broadcast
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sync_ops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  op TEXT NOT NULL,
  payload TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  external_order_id TEXT,
  delivery_id INTEGER REFERENCES deliveries(id),
  payload TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// ── Idempotent migrations ──────────────────────────────────────────────────
// CREATE TABLE IF NOT EXISTS above does not alter pre-existing tables, so add
// any missing columns here. Each is nullable → safe to add to a populated DB.
function addColumnIfMissing(table: string, column: string, ddl: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
}

// Driver home / route end point (see Profile → end point picker).
addColumnIfMissing('users', 'end_lat', 'REAL');
addColumnIfMissing('users', 'end_lon', 'REAL');
addColumnIfMissing('users', 'end_address', 'TEXT');
addColumnIfMissing('users', 'end_plus_code', 'TEXT');

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  role: 'admin' | 'dispatcher' | 'driver';
  tier: 'free' | 'pro';
  phone: string | null;
  created_at: string;
  end_lat: number | null;
  end_lon: number | null;
  end_address: string | null;
  end_plus_code: string | null;
}

export function publicUser(u: UserRow) {
  const { password_hash, ...rest } = u;
  return rest;
}

function seed() {
  const count = (db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }).c;
  if (count > 0) return; // seed only if empty
  console.log('[db] empty database — seeding demo data');

  const hash = (pw: string) => bcrypt.hashSync(pw, 10);
  const insUser = db.prepare(
    'INSERT INTO users (email, password_hash, name, role, tier, phone) VALUES (?,?,?,?,?,?)'
  );
  const admin = insUser.run('admin@muulroute.com', hash('admin123'), 'Asha Admin', 'admin', 'pro', '+91-9000000001').lastInsertRowid as number;
  insUser.run('dispatcher@muulroute.com', hash('disp123'), 'Dev Dispatcher', 'dispatcher', 'pro', '+91-9000000002');
  const d1 = insUser.run('rajesh@muulroute.com', hash('driver123'), 'Rajesh Kumar', 'driver', 'free', '+91-9814011101').lastInsertRowid as number;
  const d2 = insUser.run('amit@muulroute.com', hash('driver123'), 'Amit Sharma', 'driver', 'free', '+91-9814011102').lastInsertRowid as number;
  insUser.run('vikram@muulroute.com', hash('driver123'), 'Vikram Singh', 'driver', 'pro', '+91-9814011103');

  db.prepare('INSERT INTO regions (id, name, version, size_bytes, bounds) VALUES (?,?,?,?,?)').run(
    'IN-CHD',
    'Chandigarh',
    4,
    81788928, // ~78 MB
    JSON.stringify([30.6, 76.6, 30.9, 76.9])
  );

  const insDel = db.prepare(`INSERT INTO deliveries
    (pickup_address, pickup_lat, pickup_lon, pickup_plus_code,
     dropoff_address, dropoff_lat, dropoff_lon, dropoff_plus_code,
     customer_name, customer_phone, cod_amount, weight_kg, priority, deadline, time_window,
     status, assigned_driver_id, created_at, updated_at, accepted_at, started_at, completed_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const pc = (lat: number, lon: number) => plusEncode(lat, lon);
  const now = new Date();
  const todayAt = (h: number, m = 0) => {
    const d = new Date(now);
    d.setUTCHours(h, m, 0, 0);
    return d.toISOString().replace('T', ' ').slice(0, 19);
  };
  const dl = todayAt(15);
  // [pickupAddr, plat, plon, dropAddr, dlat, dlon, customer, phone, cod, kg, prio, status, driver, accepted, started, completed]
  const rows: (string | number | null)[][] = [
    ['Warehouse Sec 26, Chandigarh', 30.7246, 76.8053, 'House 114, Sector 17, Chandigarh', 30.7400, 76.7830, 'Neha Gupta', '+91-9876500001', 450, 2.5, 8, 'delivered', d1, todayAt(4), todayAt(4, 20), todayAt(5, 10)],
    ['Warehouse Sec 26, Chandigarh', 30.7246, 76.8053, 'SCO 22, Sector 22, Chandigarh', 30.7370, 76.7710, 'Rohit Verma', '+91-9876500002', null, 1.2, 5, 'delivered', d1, todayAt(4), todayAt(4, 30), todayAt(5, 40)],
    ['Hub Sector 34, Chandigarh', 30.7196, 76.7565, 'Flat 4B, Sector 35, Chandigarh', 30.7180, 76.7400, 'Simran Kaur', '+91-9876500003', 899, 3.0, 7, 'delivered', d2, todayAt(5), todayAt(5, 15), todayAt(6, 5)],
    ['Hub Sector 34, Chandigarh', 30.7196, 76.7565, 'Shop 8, Sector 15, Chandigarh', 30.7580, 76.7750, 'Harpreet Singh', '+91-9876500004', 1200, 5.5, 9, 'in_transit', d1, todayAt(6), todayAt(6, 30), null],
    ['Warehouse Sec 26, Chandigarh', 30.7246, 76.8053, 'House 55, Sector 8, Chandigarh', 30.7670, 76.7920, 'Anjali Mehta', '+91-9876500005', null, 0.8, 4, 'driver_accepted', d2, todayAt(7), null, null],
    ['Hub Sector 34, Chandigarh', 30.7196, 76.7565, 'PGI Campus, Sector 12, Chandigarh', 30.7649, 76.7750, 'Dr. K. Rao', '+91-9876500006', 250, 0.5, 10, 'assigned', d1, null, null, null],
    ['Warehouse Sec 26, Chandigarh', 30.7246, 76.8053, 'Elante Mall, Industrial Area Ph 1', 30.7055, 76.8013, 'Store Desk', '+91-9876500007', 3400, 12.0, 6, 'assigned', d2, null, null, null],
    ['Hub Sector 34, Chandigarh', 30.7196, 76.7565, 'House 210, Sector 44, Chandigarh', 30.7000, 76.7530, 'Manish Jain', '+91-9876500008', null, 2.2, 3, 'pending', null, null, null, null],
    ['Warehouse Sec 26, Chandigarh', 30.7246, 76.8053, 'Sukhna Lake Gate 1, Sec 1', 30.7421, 76.8188, 'Ticket Counter', '+91-9876500009', 150, 0.3, 2, 'pending', null, null, null, null],
    ['Hub Sector 34, Chandigarh', 30.7196, 76.7565, 'House 77, Sector 46, Chandigarh', 30.6890, 76.7590, 'Pooja Rani', '+91-9876500010', 640, 1.5, 5, 'pending', null, null, null, null],
    ['Warehouse Sec 26, Chandigarh', 30.7246, 76.8053, 'Hostel 5, Panjab University, Sec 14', 30.7588, 76.7681, 'Arjun Nair', '+91-9876500011', null, 1.0, 6, 'failed', d1, todayAt(3), todayAt(3, 20), null],
    ['Hub Sector 34, Chandigarh', 30.7196, 76.7565, 'House 33, Sector 21, Chandigarh', 30.7310, 76.7740, 'Kavita Joshi', '+91-9876500012', 780, 2.0, 7, 'pending', null, null, null, null],
  ];
  for (const r of rows) {
    insDel.run(
      r[0], r[1], r[2], pc(r[1] as number, r[2] as number),
      r[3], r[4], r[5], pc(r[4] as number, r[5] as number),
      r[6], r[7], r[8], r[9], r[10], dl, r[11] === 'pending' ? '10:00-13:00' : '09:00-12:00',
      r[11], r[12], todayAt(2), todayAt(8), r[13], r[14], r[15]
    );
  }
  db.prepare("UPDATE deliveries SET fail_reason='Customer unavailable' WHERE status='failed'").run();

  const insFb = db.prepare('INSERT INTO feedback (delivery_id, user_id, type, rating, comment) VALUES (?,?,?,?,?)');
  insFb.run(1, d1, 'rating', 5, 'Very fast delivery, polite driver.');
  insFb.run(2, d2, 'like', null, 'Package arrived in perfect condition.');
  insFb.run(3, d2, 'rating', 3, 'Delivery was late by an hour.');

  const insN = db.prepare('INSERT INTO notifications (user_id, title, body) VALUES (?,?,?)');
  insN.run(null, 'Welcome to MuulRoute', 'Region IN-CHD v4 offline bundle is available.');
  insN.run(d1, 'New assignment', 'You have a new high-priority delivery at PGI Campus.');

  console.log(`[db] seeded (admin id=${admin})`);
}

seed();
