# Deliveries Screen — Bugs & Missing Flows

_Static review of `driver/src/pages/Queue.tsx` cross-checked against `backend/src/routes/deliveries.ts`, `MapPage.tsx`, `CompleteModal.tsx` and `FailModal.tsx`. App-wide items live in [DRIVER_APP_REVIEW.md](DRIVER_APP_REVIEW.md); everything below is specific to this screen and not duplicated there._

---

## Summary

| # | Item | Type | Severity | Status |
|---|------|------|----------|--------|
| 1 | Optimize result wiped by the 25s poller; stop chips survive | Bug | High | Open |
| 2 | MapPage still has the id-type mismatch — route drawn unoptimized | Bug | High | Open |
| 3 | Optimizer ignores pickup coordinates | Bug | High | Open |
| 4 | Fail errors are invisible behind the modal | Bug | Medium | Open |
| 5 | Queue search doesn't match the address shown on the card | Bug | Medium | Open |
| 6 | `donePage` never clamped → blank Closed tab | Bug | Medium | Open |
| 7 | Closed tab ordered by priority, not recency | Bug | Medium | Open |
| 8 | Unsequenced concurrent loads | Bug | Low | Open |
| 9 | Assorted minor issues | Polish | Low | Open |
| 10 | Map button doesn't focus the tapped delivery | Missing flow | Medium | Open |
| 11 | No stale-route invalidation after complete/fail | Missing flow | Medium | Open |
| 12 | No offline behaviour on this screen | Missing flow | High | Open |
| 13 | No "arrived at pickup" step | Missing flow | Medium | Open |
| 14 | No COD collection confirmation | Missing flow | Medium | Open |

---

## Bugs

### 1. Optimize result is wiped ~25s later, but the stop numbers stay

[`Queue.tsx:87`](driver/src/pages/Queue.tsx#L87) re-sorts every load by priority, and the poller runs `load()` every 25s plus on window focus ([`Queue.tsx:102-112`](driver/src/pages/Queue.tsx#L102-L112)). After Optimize, card order reverts to priority order while the "Stop N" chips still come from `sessionStorage` ([`Queue.tsx:222-231`](driver/src/pages/Queue.tsx#L222-L231)) — the driver ends up looking at cards numbered 3, 1, 2.

**Fix shape:** hold the optimized ordering in state (or persist server-side) and re-apply it inside `load()` after the priority sort, rather than mutating the list once.

### 2. The id-type mismatch fixed in Queue is still live in MapPage

[`MapPage.tsx:36-37`](driver/src/pages/MapPage.tsx#L36-L37) builds `new Map(active.map((d) => [d.id, d]))` and looks up `cache.stopIds` — but `stopIds` are strings of `order_id || id` ([`Queue.tsx:178-180`](driver/src/pages/Queue.tsx#L178-L180)) while `d.id` is a number. The lookup always misses, `fromCache` is empty, and the map silently falls back to drawing the **unoptimized** route.

**Fix shape:** the same normalization applied in review item #1 of the app-wide doc — `String(d.order_id || d.id)` on both sides of the map.

### 3. Optimize ignores pickups

The backend optimizes over `dropoff_lat`/`dropoff_lon` only ([`deliveries.ts:432`](backend/src/routes/deliveries.ts#L432), [`:441`](backend/src/routes/deliveries.ts#L441), [`:452`](backend/src/routes/deliveries.ts#L452)). A delivery in `assigned` / `driver_accepted` has its *pickup* as the next stop — which the optimizer never sees. MapPage already knows this and inserts pickups into the waypoints ([`MapPage.tsx:46-52`](driver/src/pages/MapPage.tsx#L46-L52)), so the stop sequence and the reported km disagree with the route actually drawn.

### 4. Fail errors are invisible

`failDelivery` catches into the page-level `setError` ([`Queue.tsx:143`](driver/src/pages/Queue.tsx#L143)) but leaves `FailModal` mounted, and the modal renders no error of its own ([`FailModal.tsx`](driver/src/components/FailModal.tsx)). On a 403/409 the button flips back from "Submitting…" and nothing appears to happen — the banner is behind the overlay.

### 5. Queue search doesn't match the address on screen

The card shows `pickup.address` for `assigned` / `driver_accepted` ([`Queue.tsx:262`](driver/src/pages/Queue.tsx#L262)), but search only checks `dropoff.address` ([`Queue.tsx:200-205`](driver/src/pages/Queue.tsx#L200-L205)). Searching for the pickup text visible on the card returns "No results". `order_id` and `customer_phone` aren't searched either, despite the placeholder reading "Search customer or address…".

### 6. `donePage` is never clamped

It resets only on search change ([`Queue.tsx:236`](driver/src/pages/Queue.tsx#L236)). If a poll shrinks the closed list while the driver is on the last page, `pagedDone` is empty but `filteredDone.length > 0`, so the empty state doesn't render either — a blank tab reading "3 / 2".

### 7. Closed tab is ordered by priority, not recency

The single sort at [`Queue.tsx:87`](driver/src/pages/Queue.tsx#L87) applies to both tabs, so the closed list comes back P9-first instead of most-recently-closed first — which is what the per-row timestamp ([`Queue.tsx:356-359`](driver/src/pages/Queue.tsx#L356-L359)) implies.

### 8. Unsequenced concurrent loads

`load()` ([`Queue.tsx:83-96`](driver/src/pages/Queue.tsx#L83-L96)) has no in-flight guard or request id. An action's `await load()` and the 25s poller can resolve out of order, briefly restoring pre-action state.

### 9. Minor

- Complete button lacks `disabled={busyId === d.id}` ([`Queue.tsx:320-325`](driver/src/pages/Queue.tsx#L320-L325)) — reachable while a fail is in flight.
- `setNotice('Need at least 2 active deliveries to optimize.')` ([`Queue.tsx:155`](driver/src/pages/Queue.tsx#L155)) is dead code; the button is already disabled under that condition ([`Queue.tsx:468`](driver/src/pages/Queue.tsx#L468)).
- `location.state?.refreshQueue` is never cleared, so a second deep-link accept doesn't re-fire the effect — the dep value is `true` both times ([`Queue.tsx:77-81`](driver/src/pages/Queue.tsx#L77-L81)).
- `Countdown` ticks every 30s and renders "0m" under a minute ([`Queue.tsx:36-54`](driver/src/pages/Queue.tsx#L36-L54)).
- `₹` is hardcoded in both card renderers ([`Queue.tsx:293`](driver/src/pages/Queue.tsx#L293), [`:378`](driver/src/pages/Queue.tsx#L378)).

---

## Missing flows

### 10. The map button doesn't focus the delivery
[`Queue.tsx:343`](driver/src/pages/Queue.tsx#L343) is a bare `navigate('/map')` with no id or router state, so the map opens on the whole route regardless of which card was tapped.

### 11. No stale-route invalidation
Completing or failing a stop leaves `optimizedRoute` in `sessionStorage` untouched ([`Queue.tsx:187`](driver/src/pages/Queue.tsx#L187)). Stop numbers keep referring to a route that no longer exists, and are never resequenced.

### 12. No offline behaviour on this screen
The new [`driver/src/offline/`](driver/src/offline/) (`tiles.ts`, `tileCache.ts`) is map-tile only. Queue has no cached list and no queued actions — going offline shows a red error banner and the driver can't accept, complete or fail anything.

### 13. No "arrived at pickup" step
`/start` goes straight from `driver_accepted` to `in_transit` ([`deliveries.ts:350-352`](backend/src/routes/deliveries.ts#L350-L352)), so `picked_up` is unreachable from this screen even though the UI has styling and `ACTIVE_STATUSES` entries for it. (Same root cause as item #3 of [DRIVER_APP_REVIEW.md](DRIVER_APP_REVIEW.md).)

### 14. No COD collection confirmation
The COD chip is prominent on both card types, but `CompleteModal` sends only signature + notes ([`CompleteModal.tsx:33-37`](driver/src/components/CompleteModal.tsx#L33-L37)) — no cash-collected acknowledgement, no reconciliation.

---

## Suggested order of work

1. **#1 → #2 → #3** — one coherent bug in the Optimize → Map flow, and the most visibly broken feature on the screen.
2. **#4 + #5 + #6** — small, self-contained correctness fixes the driver hits daily.
3. **#7** — separate the sorts for the Queue and Closed tabs.
4. **#10 + #11** — finish the per-card map flow and invalidate the route cache on close.
5. **#12** — largest effort; the offline story for the delivery list doesn't exist yet.

> All findings are from static review of the code; runtime verification is still blocked by the `better-sqlite3` native build noted at the end of [DRIVER_APP_REVIEW.md](DRIVER_APP_REVIEW.md).
