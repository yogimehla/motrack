# Driver App — Review: Bugs & Missing Flows

_Review of `driver/` cross-checked against the `backend/` API. Line references are clickable in the repo._

---

## Summary

| # | Item | Type | Severity | Status |
|---|------|------|----------|--------|
| 1 | Optimize "Stop N" chips + reordering (id type mismatch) | Bug | High | ✅ Fixed |
| 2 | Deep-link delivery is a dead end when logged out / token expired | Bug | High | Open |
| 3 | Incomplete status state machine (`picked_up` / `near_destination` unreachable) | Bug / Missing | Medium | Open |
| 4 | Profile "Today" count ≠ server free-tier enforcement | Bug | Medium | Open |
| 5 | No token refresh (12h expiry, `/auth/refresh` unused) | Missing flow | High | Open |
| 6 | POD has no photo / OTP capture | Missing flow | High | Open |
| 7 | Offline region download is faked; no offline map tiles | Missing flow | High | Open |
| 8 | Notifications: no push, not actionable, read-state client-only | Missing flow | Medium | Open |
| 9 | ReceiveDelivery "Decline" is a server-side no-op | Bug / Missing | Medium | Open |
| 10 | COD cash-collected never confirmed on completion | Missing flow | Medium | Open |
| 11 | Arrival / near-destination not persisted to backend | Missing flow | Low | Open |
| 12 | 401 handler does hard reload; TabBar shows on deep-link page; COD truthiness | Polish | Low | Open |

---

## Bugs

### 1. Optimize "Stop N" chips + post-optimize reordering — id type mismatch ✅ Fixed

The optimizer round-trips IDs as **strings** (`String(r.id)` in [`backend/src/routes/deliveries.ts:452`](backend/src/routes/deliveries.ts#L452), returned by [`Heuristic2Opt.ts:116`](backend/src/adapters/optimizer/Heuristic2Opt.ts#L116)), but a delivery's `id` from the API is a **number**, and seed/manual deliveries have a `null` `order_id`. So the `Map` lookups never matched:

- Reorder loop looked up stringified ids in a number-keyed map → no match → cards stayed in original order.
- `optimizedOrder.get(d.id)` did `get(8)` against key `"8"` → always `undefined` → stop badges never rendered.

Driver saw the green "Route optimized — X km" notice but **nothing changed and no stop numbers appeared**.

**Fix applied** — normalize both keys to strings:
- [`Queue.tsx:182`](driver/src/pages/Queue.tsx#L182): `new Map(deliveries.map((d) => [String(d.order_id || d.id), d]))`
- [`Queue.tsx:240`](driver/src/pages/Queue.tsx#L240): `optimizedOrder.get(String(d.order_id || d.id))`

### 2. Deep-link delivery is a dead end when logged out / token expired

Real link (from `DEEP_LINK_API.md`):
```
http://localhost:4012/delivery?orderId=INV-20260730-0214&customer=test&address=Sector+4&lat=30.751857&lon=76.8014146&total=91.98&cod=true
```

Because JWTs expire in **12h** ([`EmailPasswordProvider.ts:14`](backend/src/adapters/auth/EmailPasswordProvider.ts#L14)), most drivers tap the link with a stale token. Then:

1. `/delivery` renders `<ReceiveDelivery>` — the route is **not** wrapped in `RequireAuth` ([`App.tsx:27-28`](driver/src/App.tsx#L27-L28)).
2. It calls `GET /deliveries/from-link` (auth + driver only, [`deliveries.ts:169`](backend/src/routes/deliveries.ts#L169)) → **401**.
3. Interceptor wipes the token and does a **hard** `window.location.href = '/login'` ([`api.ts:22-25`](driver/src/api.ts#L22-L25)), discarding the URL + all query params.
4. Login always returns to `/` ([`Login.tsx:22`](driver/src/pages/Login.tsx#L22)). The `from-link` GET (which *creates* the delivery) never ran, so **the order is silently lost**.

The `/delivery/:id` variant loads via public `GET /deliveries/:id/public` ([`deliveries.ts:159`](backend/src/routes/deliveries.ts#L159)) but dead-ends one step later when **Accept** 401s.

**Root causes:** unguarded `/delivery*` route, hard-redirect that drops the URL, and login that ignores the intended destination.

**Fix shape:** capture `pathname+search` as `?next=` on 401 (router navigate, not `window.location`), honor `next` after login, and optionally guard `/delivery*` with `RequireAuth` (keeping `/public` readable pre-login).

### 3. Incomplete status state machine — `picked_up` / `near_destination` unreachable

The frontend has full UI for `picked_up` and `near_destination` (colors, `ACTIVE_STATUSES`, markers, `DetailModal`), but the backend never sets them — `/start` jumps `driver_accepted → in_transit` ([`deliveries.ts:350-352`](backend/src/routes/deliveries.ts#L350-L352)). The "Start pickup" button therefore skips the pickup step, and MapPage's near-destination detection is client-only.

### 4. Profile "Today" count ≠ server free-tier enforcement

Profile derives today's count from each delivery's `created_at`/`updated_at` ([`Profile.tsx:27-33,50`](driver/src/pages/Profile.tsx#L27-L33)), but the server enforces the free-tier limit on **`accepted_at` today** ([`deliveries.ts:102-110`](backend/src/routes/deliveries.ts#L102-L110)). The "X of 10" and "Daily limit reached" banner can disagree with what the backend actually blocks.

---

## Missing flows

### 5. Token refresh — drivers logged out mid-shift
`POST /auth/refresh` exists ([`auth.ts:45`](backend/src/routes/auth.ts#L45)) but the app never calls it. With a 12h expiry, drivers are force-logged-out during a shift (and lose deep links). _Add refresh-on-401-then-retry, or proactive refresh._

### 6. Proof-of-delivery: no photo, no OTP
The complete endpoint accepts `photo_base64` and `otp` ([`deliveries.ts:41-47`](backend/src/routes/deliveries.ts#L41-L47)), but `CompleteModal` captures only signature + notes ([`CompleteModal.tsx:33-37`](driver/src/components/CompleteModal.tsx#L33-L37)). No camera capture or OTP entry exists.

### 7. Offline region download is faked
`startDownload` animates a random progress bar and flips a local flag ([`Regions.tsx:31-47`](driver/src/pages/Regions.tsx#L31-L47)); it never calls `GET /regions/:id/download` ([`regions.ts:51-64`](backend/src/routes/regions.ts#L51-L64)), stores nothing, and loses state on reload. Both maps hard-code **online** OSM tiles ([`MapPage.tsx:188`](driver/src/pages/MapPage.tsx#L188), [`EndPointPicker.tsx:106`](driver/src/components/EndPointPicker.tsx#L106)) — so there is no offline map at all.

### 8. Notifications: no push, not actionable, read-state client-only
- No real-time push — `FcmNotifier` exists in the backend but `InAppNotifier` is active; the app polls every 25s/60s ([`Queue.tsx:103`](driver/src/pages/Queue.tsx#L103), [`TabBar.tsx:34`](driver/src/components/TabBar.tsx#L34)).
- Tapping a notification does nothing — no link to the referenced delivery ([`Notifications.tsx:106-133`](driver/src/pages/Notifications.tsx#L106-L133)).
- "Seen" is a `localStorage` max-id ([`Notifications.tsx:38`](driver/src/pages/Notifications.tsx#L38)), never synced to the server.

### 9. ReceiveDelivery "Decline" is a server-side no-op
Decline just `navigate('/')` ([`ReceiveDelivery.tsx:200-204`](driver/src/pages/ReceiveDelivery.tsx#L200)) — the backend is never told, so the delivery stays assigned. The map popup, by contrast, posts a real fail reason ([`MapPage.tsx:283`](driver/src/pages/MapPage.tsx#L283)).

### 10. COD cash-collected never confirmed
COD amounts are displayed everywhere, but completion records no "cash collected" acknowledgement — no field in the complete payload, no UI prompt. No cash reconciliation.

### 11. Arrival / near-destination not persisted
MapPage sets local `nearDest` within 200m ([`MapPage.tsx:386-389`](driver/src/pages/MapPage.tsx#L386-L389)) but never PATCHes the backend — invisible to dispatch, lost on reload.

### 12. Polish
- 401 handler uses a hard `window.location` reload, dropping in-app state ([`api.ts:22-25`](driver/src/api.ts#L22-L25)).
- TabBar shows on the deep-link `/delivery` page (hidden only on `/login`, [`App.tsx:36`](driver/src/App.tsx#L36)).
- `ReceiveDelivery` COD checks use `cod_amount && …` — a `0` amount reads as "no COD"; use `!= null` ([`ReceiveDelivery.tsx:169,174`](driver/src/pages/ReceiveDelivery.tsx#L169)).

---

## Suggested order of work

1. **#5 Token refresh** (refresh-on-401 + retry) — also softens the deep-link dead-end.
2. **#2 Deep-link redirect-after-login** — recover lost orders.
3. **#6 POD photo + OTP** — completes the delivery-proof flow (backend already accepts them).
4. **#8 Actionable / real-time notifications.**
5. **#7 Real offline region download** — largest effort; the "offline" feature currently doesn't exist.

> Note: runtime verification is currently blocked — the backend won't start until the `better-sqlite3` native build is fixed (bump to `^12.2.0` for a prebuilt Node 24 binary). All findings above are from static review of the code.
