# Deep Link Delivery API Implementation

## Overview
This document explains the backend endpoint needed to handle deep link deliveries from URLs.

---

## Endpoint to Create/Add

### GET /delivery/from-link

**Purpose:** Create or fetch delivery from URL parameters and assign to current driver

**URL Format:**
```
GET /delivery/from-link?orderId=INV-20260730-0214&customer=test&phone=%2B913344666666&address=Sector+4&lat=30.751857&lon=76.8014146&total=91.98&cod=true&items=2
```

**Query Parameters:**
```
orderId (string)      - Unique order identifier
customer (string)     - Customer name
phone (string)        - Customer phone number
address (string)      - Delivery address
lat (number)          - Latitude
lon (number)          - Longitude
total (number)        - Total amount
cod (boolean)         - Cash on Delivery flag
items (number)        - Number of items
```

**Response (Success):**
```json
{
  "id": "del_abc123xyz",
  "customer_name": "test",
  "customer_phone": "+913344666666",
  "pickup": {
    "address": "PWA Warehouse",
    "lat": 30.75,
    "lon": 76.80
  },
  "dropoff": {
    "address": "Sector 4, Ward 1, Chandigarh, 160001, India",
    "lat": 30.751857,
    "lon": 76.8014146
  },
  "cod_amount": 91.98,
  "priority": 5,
  "status": "assigned",
  "id": "del_abc123"
}
```

**Response (Error):**
```json
{
  "error": "Invalid parameters"
}
```

---

## Backend Logic

```javascript
// GET /delivery/from-link

async handleDeliveryFromLink(req, res) {
  try {
    // 1. Extract and validate query parameters
    const { orderId, customer, phone, address, lat, lon, total, cod, items } = req.query;
    
    if (!orderId || !customer || !phone || !address || !lat || !lon) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // 2. Get current driver (from JWT token)
    const driverId = req.user.userId;
    const adminId = req.user.adminId; // Current admin context

    // 3. Check if delivery already exists with this orderId
    let delivery = await db.query(
      'SELECT * FROM deliveries WHERE order_id = ? AND driver_id = ?',
      [orderId, driverId]
    );

    if (delivery) {
      // Delivery already exists, return it
      return res.json(delivery);
    }

    // 4. Create new delivery record
    const deliveryId = uuid();
    const deliveryRecord = {
      id: deliveryId,
      order_id: orderId,
      driver_id: driverId,
      admin_id: adminId,
      customer_name: customer,
      customer_phone: phone,
      pickup: {
        address: 'PWA Warehouse', // Default or from config
        lat: 30.75,  // Default pickup location
        lon: 76.80
      },
      dropoff: {
        address: decodeURIComponent(address),
        lat: parseFloat(lat),
        lon: parseFloat(lon)
      },
      cod_amount: parseFloat(total),
      priority: cod === 'true' ? 7 : 5, // Higher priority for COD
      status: 'assigned',
      created_at: new Date(),
      created_by: 'deep_link'
    };

    // 5. Insert into database
    await db.insert('deliveries', deliveryRecord);

    // 6. Create pickup stop record (if needed)
    const pickupId = uuid();
    await db.insert('stops', {
      id: pickupId,
      delivery_id: deliveryId,
      type: 'pickup',
      address: 'PWA Warehouse',
      lat: 30.75,
      lon: 76.80,
      sequence: 1
    });

    // 7. Create dropoff stop record
    const dropoffId = uuid();
    await db.insert('stops', {
      id: dropoffId,
      delivery_id: deliveryId,
      type: 'dropoff',
      address: decodeURIComponent(address),
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      sequence: 2
    });

    // 8. Log the action
    console.log(`Deep link delivery created: ${deliveryId} for driver ${driverId}`);

    // 9. Return the created delivery
    res.json(deliveryRecord);

  } catch (error) {
    console.error('Error handling deep link delivery:', error);
    res.status(500).json({ error: 'Failed to process delivery' });
  }
}
```

---

## Database Schema Needed

Make sure your `deliveries` table has these columns:

```sql
CREATE TABLE deliveries (
  id UUID PRIMARY KEY,
  order_id VARCHAR UNIQUE,  -- From URL parameter
  driver_id UUID,
  admin_id UUID,
  customer_name VARCHAR,
  customer_phone VARCHAR,
  pickup JSON,  -- { address, lat, lon }
  dropoff JSON, -- { address, lat, lon }
  cod_amount DECIMAL,
  priority INT,
  status VARCHAR,
  created_at TIMESTAMP,
  created_by VARCHAR,  -- 'deep_link', 'admin', etc
  FOREIGN KEY (driver_id) REFERENCES users(id),
  FOREIGN KEY (admin_id) REFERENCES users(id)
);
```

---

## Integration Steps

### 1. Add Route in Your Backend
```javascript
// In your Express/Node backend
app.get('/delivery/from-link',
  authMiddleware,
  handleDeliveryFromLink
);
```

### 2. Add to Your Driver App API Service
Already done! ✓ The API call is in `ReceiveDelivery.tsx`:
```typescript
const res = await api.get(`/delivery/from-link${queryString}`);
```

### 3. Make Sure Queue Refreshes
Already done! ✓ Queue component now refreshes when returning from deep link.

---

## Testing

### Test URL
```
http://localhost:4012/delivery?
orderId=INV-20260730-0214&
customer=test&
phone=%2B913344666666&
address=Sector+4%2C+Ward+1%2C+Chandigarh&
lat=30.751857&
lon=76.8014146&
total=91.98&
cod=true&
items=2
```

### Expected Flow
1. ✓ Driver clicks URL from SMS/notification
2. ✓ App loads ReceiveDelivery page
3. ✓ Frontend calls `GET /delivery/from-link?...`
4. ✓ Backend creates delivery in database
5. ✓ Shows delivery card to driver
6. ✓ Driver clicks "Accept Delivery"
7. ✓ Frontend calls `POST /deliveries/{id}/accept`
8. ✓ Backend updates status to 'accepted'
9. ✓ Redirects to Queue
10. ✓ Queue auto-refreshes and shows new delivery ✓

---

## Key Points

✅ **Single Use Prevention:**
- Check if `order_id` already exists before creating
- Only create if new

✅ **Multi-Admin Support:**
- Always use `admin_id` from JWT token
- Don't trust from URL parameters

✅ **Data Validation:**
- Validate all parameters exist
- Parse numbers correctly (lat, lon, total)
- Decode URL-encoded strings (address)

✅ **Error Handling:**
- Return 400 for missing parameters
- Return 500 for database errors
- Return existing delivery if already created

---

## Alternative: Simplified Version (Minimal)

If you want a simpler version without pickup stops:

```javascript
async handleDeliveryFromLink(req, res) {
  const { orderId, customer, phone, address, lat, lon, total, cod } = req.query;
  
  const deliveryId = uuid();
  const newDelivery = {
    id: deliveryId,
    order_id: orderId,
    driver_id: req.user.userId,
    admin_id: req.user.adminId,
    customer_name: customer,
    customer_phone: phone,
    dropoff: {
      address: decodeURIComponent(address),
      lat: parseFloat(lat),
      lon: parseFloat(lon)
    },
    cod_amount: parseFloat(total),
    status: 'assigned'
  };

  await db.insert('deliveries', newDelivery);
  res.json(newDelivery);
}
```

---

## Frontend Already Updated ✓

The following files have been updated and are ready:

1. **ReceiveDelivery.tsx**
   - ✓ Fetches delivery from backend
   - ✓ Shows loading state
   - ✓ Handles errors
   - ✓ Calls accept API
   - ✓ Redirects with refresh flag

2. **Queue.tsx**
   - ✓ Listens for refresh flag from location.state
   - ✓ Auto-refreshes queue on return from deep link
   - ✓ Shows newly accepted delivery

---

## What's Left

**Just add the backend endpoint!** That's it.

Once you add `GET /delivery/from-link` endpoint to your backend with the logic above, everything will work:

1. Deep link opens → ReceiveDelivery page
2. Shows delivery details from backend
3. Driver accepts → API call
4. Redirects to Queue → Auto-refreshes
5. New delivery appears! ✓

---

## Summary

| Component | Status | What it does |
|-----------|--------|------------|
| Frontend Load | ✓ Done | Fetches delivery from backend URL |
| Frontend Accept | ✓ Done | Calls /deliveries/{id}/accept API |
| Frontend Redirect | ✓ Done | Sends refreshQueue flag to Queue |
| Queue Refresh | ✓ Done | Listens for flag and refreshes |
| **Backend Endpoint** | ❌ TODO | Create /delivery/from-link endpoint |

**Action Required:** Implement the `/delivery/from-link` endpoint in your backend using the code above.
