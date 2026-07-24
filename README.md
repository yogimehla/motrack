# MuulRoute v1.1 — Offline-First Delivery Ecosystem

Backend API + Admin Dashboard + Driver PWA demo. Part of the MuulOrigin ecosystem (MoInvoice integration ready).

## Packages

| Package | Stack | Port |
|---|---|---|
| `backend/` | Node 20 + Hono + better-sqlite3 + JWT | 4010 |
| `admin/` | React 18 + Vite + Tailwind + MapLibre + Recharts | 4011 |
| `driver/` | React 18 + Vite + Tailwind + MapLibre (mobile-first PWA) | 4012 |

## Quick Start

```bash
cd backend && npm install && npm run dev    # API on :4010 (auto-seeds SQLite)
cd admin   && npm install && npm run dev    # Dashboard on :4011
cd driver  && npm install && npm run dev    # Driver PWA on :4012
```

## Demo Credentials

| Role | Email | Password |
|---|---|---|
| Admin | admin@muulroute.com | admin123 |
| Dispatcher | dispatcher@muulroute.com | disp123 |
| Driver | rajesh@muulroute.com | driver123 |

## Architecture — Everything is an Adapter

Interfaces in `backend/src/adapters/` — swap implementations via config, never via rewrites:

- **IAuthProvider**: EmailPassword (active) · MuulOriginSso (V2 stub, mo_token cookie bridge) · PhoneOtp (V3)
- **IOptimizer**: Heuristic2Opt (active, pure-TS NN+2-opt) · ORToolsServer (V2) · NLPEnterprise (V3)
- **IGeocoder**: Nominatim (active, graceful offline fallback) · OfflineBundle (V2) · PlusCode (active, byte-exact OLC)
- **IOrderSource**: MoInvoice (active webhook) · Csv
- **IMapStorage**: R2 (stub) · **INotifier**: InApp (active) · FCM (stub)

## MoInvoice Integration

```bash
curl -X POST http://localhost:4010/api/v1/integrations/moinvoice/order \
  -H "X-MoInvoice-Key: dev-key" -H "Content-Type: application/json" \
  -d '{"order_id":"INV-1001","store":{"lat":30.7333,"lon":76.7794,"address":"Sector 17, Chandigarh"},
       "customer":{"name":"Amit","phone":"+919988776655","address":"Sector 22","lat":30.7222,"lon":76.7889},
       "amount":1849,"items":[]}'
```
Creates a COD delivery (pickup=store, dropoff=customer, cod=invoice total).

## Free Tier

Drivers on `free` tier: max 10 accepted deliveries/day (HTTP 402 beyond). Maps on CDN (R2 free egress) + on-device routing = ~$0 marginal cost.

## Roadmap

- **V2**: MuulOrigin SSO, OR-Tools server optimizer, offline geocoder bundles, FCM push, POD photo+OTP, driver earnings view, map-issue reporting
- **V3**: Delta map updates, phone OTP, OR-Tools on-device, P2P tile sharing, corridor downloads, epoch-encrypted map bundles, live-tracking links, ML ETA

Map data © OpenStreetMap contributors (ODbL).
