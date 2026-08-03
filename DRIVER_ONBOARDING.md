# Driver Onboarding & QR Code Sign-In System

## Table of Contents
1. [Overview](#overview)
2. [Driver Creation Flow](#driver-creation-flow)
3. [QR Code Implementation](#qr-code-implementation)
4. [Multi-Admin Support](#multi-admin-support)
5. [Database Schema](#database-schema)
6. [API Endpoints](#api-endpoints)
7. [Implementation Timeline](#implementation-timeline)

---

## Overview

MuulRoute supports two driver onboarding methods:
- **Self-Registration**: Driver signs up in app, admin approves
- **Admin Invite**: Admin creates driver with QR code

The system supports **multi-admin capability**, allowing drivers to work with multiple delivery companies simultaneously.

---

## Driver Creation Flow

### Method 1: Driver Self-Registration

```
DRIVER APP → SIGN UP
    ↓
STEP 1: Basic Details
├─ Full Name
├─ Email
├─ Phone Number
└─ Password (6+ chars)
    ↓
STEP 2: Vehicle Information
├─ Driver License Number
├─ Vehicle Type (Bike/Car/Van)
└─ License Plate
    ↓
SUBMIT TO BACKEND
    ↓
STATUS: PENDING (Cannot login yet)
    ↓
ADMIN APP: New Pending Driver Notification
    ↓
ADMIN APPROVES/REJECTS
    ↓
IF APPROVED:
├─ SMS Sent to Driver: "Account approved!"
├─ Driver status → ACTIVE
└─ Driver can now LOGIN
    ↓
IF REJECTED:
├─ SMS Sent: "Reason: ..."
└─ Driver status → INACTIVE
```

### Method 2: Admin Creates Driver

```
ADMIN APP → DRIVERS → ADD NEW DRIVER
    ↓
FILL FORM:
├─ Name
├─ Email
├─ Phone
├─ License Number
├─ Vehicle Type
└─ License Plate
    ↓
GENERATE QR CODE
    ↓
[Show QR on screen]
    ↓
SEND VIA:
├─ SMS
├─ WhatsApp
├─ Email
└─ Print
    ↓
DRIVER SCANS QR
    ↓
Auto-redirects to app with pre-filled data
    ↓
Driver sets final password
    ↓
STATUS: ACTIVE (Immediate)
    ↓
Driver can login and accept deliveries
```

---

## QR Code Implementation

### QR Code Data Structure

```
QR Code Encodes:
{
  "driver_id": "drv_abc123xyz",
  "temp_token": "temp_xyz789abc",
  "admin_id": "admin_123",
  "app_code": "MUULROUTE_DRIVER",
  "expires_at": "2026-07-30T10:30:00Z",
  "action": "join"
}
```

### QR Code URL Format

```
Deep Link:
motrack://join?
  driver_id=drv_abc123&
  token=temp_xyz789&
  admin_id=admin_123&
  expires=2026-07-30

Web Link:
https://app.motrack.com/join?
  driver_id=drv_abc123&
  token=temp_xyz789&
  admin_id=admin_123
```

### Driver Experience When Scanning QR

```
Step 1: Receive QR Code
├─ SMS/Email with QR image and link
└─ Valid for 24 hours

Step 2: Scan QR (Mobile)
├─ Open Phone Camera
├─ Point at QR
├─ Tap notification to open app
└─ OR click SMS link

Step 3: App Pre-fills Data
├─ Driver ID extracted
├─ Email pre-filled
├─ License info shown
└─ Status: Ready to complete signup

Step 4: Set Password
├─ Create secure password
├─ Confirm password
└─ Review account details

Step 5: Complete
├─ Account activated
├─ Linked to Admin
├─ Notification sent
└─ Can login immediately

Step 6: First Login
├─ Email + Password
├─ Select Admin (if multi-admin)
├─ Dashboard loads
└─ Ready to accept deliveries
```

---

## Multi-Admin Support

### What is Multi-Admin?

A single driver can work for multiple delivery companies (admins) simultaneously.

```
Driver: Rajesh Kumar
├─ Admin 1: FoodEats (since 2026-07-01)
├─ Admin 2: QuickDelivery (since 2026-07-15)
└─ Admin 3: CityExpress (since 2026-06-20)
```

### How Driver Sees Multiple Admins

#### Option A: Select at Login

```
LOGIN SCREEN:
Email: rajesh@example.com
Password: ••••••••
[LOGIN]
    ↓
ADMIN SELECTION:
○ FoodEats
○ QuickDelivery (selected)
○ CityExpress
[CONTINUE]
    ↓
DASHBOARD:
Shows only QuickDelivery deliveries
```

#### Option B: Switch Within App

```
DRIVER APP (Logged In)
    ↓
PROFILE MENU
    ↓
Current Admin: QuickDelivery ▼
    ├─ Switch to FoodEats
    ├─ Switch to CityExpress
    └─ Manage Accounts
    ↓
[Tap FoodEats]
    ↓
Queue refreshes
Shows only FoodEats deliveries
```

#### Option C: QR Code for Each Admin

```
Day 1:
├─ Scan FoodEats QR
├─ Account created/linked to FoodEats
└─ Can work for FoodEats

Day 5:
├─ Receive QuickDelivery QR
├─ Scan QR (same account/email)
├─ Linked to QuickDelivery
└─ Now can see both admins' deliveries

Result: Same driver account, multiple admins
```

### Data Isolation Per Admin

```
Admin 1 (FoodEats) Can See:
├─ Its own deliveries assigned to driver
├─ Driver's ratings on its platform
├─ Driver's earnings from FoodEats
└─ Driver's delivery history with FoodEats

Admin 1 CANNOT See:
├─ Deliveries from other admins
├─ Driver's work with competitors
├─ Driver's ratings from other platforms
└─ Driver's earnings from other companies

Same applies for Admin 2, Admin 3, etc.
```

---

## Database Schema

### Users Table

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR UNIQUE NOT NULL,
  password_hash VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  phone VARCHAR UNIQUE NOT NULL,
  role ENUM('admin', 'driver', 'customer'),
  status ENUM('active', 'pending', 'inactive', 'suspended'),
  created_at TIMESTAMP,
  created_by UUID,  -- Which admin created this user
  updated_at TIMESTAMP
);
```

### Driver Profiles Table

```sql
CREATE TABLE driver_profiles (
  user_id UUID PRIMARY KEY,
  license_number VARCHAR UNIQUE NOT NULL,
  license_expiry DATE,
  vehicle_type VARCHAR,  -- bike, car, van, auto
  license_plate VARCHAR UNIQUE,
  bank_account VARCHAR,
  aadhar_number VARCHAR,
  pan_number VARCHAR,
  documents_verified BOOLEAN DEFAULT false,
  rating DECIMAL(3,2),
  total_deliveries INT DEFAULT 0,
  verified_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Driver-Admin Mapping Table (Multi-Admin)

```sql
CREATE TABLE driver_admin_mapping (
  id UUID PRIMARY KEY,
  driver_id UUID NOT NULL,
  admin_id UUID NOT NULL,
  status ENUM('active', 'inactive', 'suspended'),
  joined_at TIMESTAMP,
  suspended_at TIMESTAMP,
  suspension_reason VARCHAR,
  rating DECIMAL(3,2),  -- Separate rating per admin
  total_deliveries INT DEFAULT 0,  -- Per admin
  total_earnings DECIMAL(10,2) DEFAULT 0,  -- Per admin
  UNIQUE(driver_id, admin_id),
  FOREIGN KEY (driver_id) REFERENCES users(id),
  FOREIGN KEY (admin_id) REFERENCES users(id)
);
```

### QR Code Tokens Table

```sql
CREATE TABLE qr_tokens (
  id UUID PRIMARY KEY,
  driver_id UUID,
  admin_id UUID NOT NULL,
  temp_token VARCHAR UNIQUE NOT NULL,
  qr_image_url VARCHAR,
  status ENUM('pending', 'used', 'expired'),
  created_at TIMESTAMP,
  expires_at TIMESTAMP,
  used_at TIMESTAMP,
  used_by_ip VARCHAR,
  FOREIGN KEY (driver_id) REFERENCES users(id),
  FOREIGN KEY (admin_id) REFERENCES users(id)
);
```

### Deliveries Table (Updated)

```sql
CREATE TABLE deliveries (
  id UUID PRIMARY KEY,
  driver_id UUID NOT NULL,
  admin_id UUID NOT NULL,  -- Track which admin assigned
  customer_name VARCHAR,
  customer_phone VARCHAR,
  pickup_address VARCHAR,
  dropoff_address VARCHAR,
  cod_amount DECIMAL(10,2),
  priority INT,
  status ENUM('assigned', 'accepted', 'completed', 'failed'),
  created_at TIMESTAMP,
  completed_at TIMESTAMP,
  FOREIGN KEY (driver_id) REFERENCES users(id),
  FOREIGN KEY (admin_id) REFERENCES users(id)
);
```

---

## API Endpoints

### Authentication

```
POST /auth/register
├─ Body: { name, email, phone, password, license_number, vehicle_type }
├─ Response: { user_id, status: 'pending' }
└─ Note: Self-registration creates PENDING status

POST /auth/login
├─ Body: { email, password }
├─ Response: { token, user, available_admins: [...] }
└─ If multi-admin, returns list of admins

POST /auth/login-with-admin
├─ Body: { token, admin_id }
└─ Response: { admin_workspace_token }
```

### Driver Management (Admin Only)

```
POST /admin/drivers
├─ Create driver manually
├─ Body: { name, email, phone, license_number, vehicle_type, license_plate }
├─ Response: { driver_id, qr_code_url }
└─ Status: ACTIVE (no approval needed)

GET /admin/drivers
├─ List all drivers under this admin
├─ Response: { drivers: [...], pending_signups: [...] }

PATCH /admin/drivers/:driver_id/approve
├─ Approve pending driver signup
├─ Response: { driver_id, status: 'active' }

PATCH /admin/drivers/:driver_id/reject
├─ Reject pending driver
├─ Body: { reason }
└─ Response: { driver_id, status: 'inactive' }

GET /admin/drivers/:driver_id
├─ View driver details for this admin
├─ Response: { name, email, phone, ratings, earnings, deliveries_count }

POST /admin/drivers/:driver_id/generate-qr
├─ Generate new QR code for driver
├─ Response: { qr_code_url, temp_token, expires_at }
```

### QR Code Handling

```
POST /auth/validate-qr
├─ Validate QR token when driver scans
├─ Body: { temp_token, driver_id }
├─ Response: { valid: true, admin_id, pre_filled: { email, ... } }
└─ Temp token valid for 24 hours, single use

POST /auth/complete-qr-signup
├─ Complete signup after scanning QR
├─ Body: { temp_token, password, driver_id }
├─ Response: { token, user, message: 'Account activated' }
└─ Links driver to admin via driver_admin_mapping
```

### Driver Operations (Multi-Admin Aware)

```
GET /deliveries
├─ Get driver's deliveries for current admin only
├─ Response: { deliveries: [...] }
└─ Filtered by: driver_id + admin_id

POST /deliveries/:id/accept
├─ Accept delivery for current admin
├─ Checks: delivery belongs to driver's current admin

GET /driver/admins
├─ List all admins this driver is linked to
├─ Response: { admins: [{ id, name, status, rating, earnings }] }

POST /driver/switch-admin
├─ Switch active admin in app
├─ Body: { admin_id }
└─ Response: { current_admin, deliveries: [...] }
```

---

## Implementation Timeline

### Week 1-2: Foundation

- [ ] Create database tables (users, driver_profiles, driver_admin_mapping)
- [ ] Update users table with role-based fields
- [ ] Create QR token table
- [ ] Update deliveries table with admin_id tracking

### Week 2-3: Backend APIs

- [ ] Implement /auth/register (self-signup)
- [ ] Implement /admin/drivers (create driver)
- [ ] Implement QR code generation
- [ ] Implement QR validation and redemption
- [ ] Add multi-admin filtering to all queries

### Week 3-4: Frontend (Driver App)

- [ ] Create Sign-Up flow (2-step form)
- [ ] Create QR scan handler
- [ ] Create admin selection screen
- [ ] Show "Awaiting approval" message for pending drivers
- [ ] Add switch admin functionality

### Week 4-5: Frontend (Admin App)

- [ ] Create "Add Driver" form
- [ ] Implement QR code display/sending
- [ ] Create "Pending Approvals" section
- [ ] Implement approve/reject functionality
- [ ] Show driver list with multi-admin status

### Week 5: Testing & Polish

- [ ] End-to-end testing (self-signup flow)
- [ ] End-to-end testing (QR code flow)
- [ ] End-to-end testing (multi-admin switching)
- [ ] SMS notifications testing
- [ ] Security testing (QR token expiry, single-use)

---

## Security Considerations

### QR Code Security

```
✅ DO:
├─ Expire QR tokens after 24 hours
├─ Make tokens single-use
├─ Invalidate after successful signup
├─ Log QR generation and usage
├─ Rate limit QR validation attempts
└─ Validate token IP doesn't change drastically

❌ DON'T:
├─ Reuse QR tokens
├─ Allow unlimited QR validation attempts
├─ Store plain passwords in QR code
├─ Share QR across multiple drivers
└─ Allow QR use after driver account activated
```

### Multi-Admin Isolation

```
✅ DO:
├─ Filter all queries by (driver_id, admin_id)
├─ Verify admin owns delivery before assignment
├─ Isolate ratings per admin
├─ Isolate earnings per admin
└─ Log cross-admin access attempts

❌ DON'T:
├─ Trust admin_id from request body alone
├─ Share delivery data across admins
├─ Mix admin sessions
├─ Allow driver to see other admin's data
└─ Store admin_id only in frontend
```

---

## Testing Checklist

### Driver Self-Registration

- [ ] Driver can sign up with valid details
- [ ] Email validation works
- [ ] Password confirmation works
- [ ] Account created with PENDING status
- [ ] Admin sees pending driver
- [ ] Admin can approve driver
- [ ] Driver gets approval SMS
- [ ] Driver can login after approval
- [ ] Admin can reject driver
- [ ] Driver gets rejection SMS

### QR Code Flow

- [ ] Admin can generate QR code
- [ ] QR code is valid and scannable
- [ ] Driver can scan QR from SMS
- [ ] Deep link opens app correctly
- [ ] Pre-filled data shows correctly
- [ ] Driver can set password
- [ ] Account activated immediately
- [ ] Driver linked to correct admin
- [ ] QR token expires after 24h
- [ ] QR token single-use (can't reuse)

### Multi-Admin

- [ ] Driver can be linked to multiple admins
- [ ] Driver sees correct deliveries per admin
- [ ] Driver can switch between admins
- [ ] Ratings isolated per admin
- [ ] Earnings isolated per admin
- [ ] Admin can't see other admin's data
- [ ] Delivery assignment respects admin context
- [ ] Delivery history shows admin name
- [ ] Profile shows all linked admins

---

## Notifications

### For Drivers

```
Scenario 1: Self-Signup → Pending
┌────────────────────────────────┐
│ SMS Notification               │
│ "Your registration is pending  │
│  admin approval. You'll get a  │
│  confirmation SMS soon."       │
└────────────────────────────────┘

Scenario 2: Admin Approves
┌────────────────────────────────┐
│ SMS Notification               │
│ "Your MuulRoute driver account │
│  has been approved! Download   │
│  the app and login."           │
└────────────────────────────────┘

Scenario 3: QR Code Signup
┌────────────────────────────────┐
│ SMS Notification               │
│ "Join MuulRoute! Scan the QR   │
│  code below to get started."   │
│ [QR CODE IMAGE]                │
│ or tap: [LINK]                 │
└────────────────────────────────┘
```

### For Admins

```
Scenario 1: New Driver Signup
┌────────────────────────────────┐
│ In-App Notification            │
│ "🆕 New driver signup pending  │
│  review"                       │
│ Name: Rajesh Kumar             │
│ Phone: 9876543210             │
│ [REVIEW]                       │
└────────────────────────────────┘

Scenario 2: QR Code Generated
┌────────────────────────────────┐
│ In-App Notification            │
│ "✅ QR code generated for      │
│  Rajesh Kumar"                 │
│ [VIEW QR] [SEND SMS]           │
└────────────────────────────────┘
```

---

## Future Enhancements

- [ ] Document verification (OCR for license/ID)
- [ ] Background check integration
- [ ] Biometric login option
- [ ] Automatic QR code sending via WhatsApp
- [ ] Driver ratings comparison across admins
- [ ] Unified earnings dashboard (all admins)
- [ ] Driver performance analytics per admin
- [ ] Bulk driver import (Excel/CSV)
- [ ] Driver onboarding video tutorials
- [ ] In-app chat support during signup

---

## FAQ

**Q: Can a driver work for multiple admins?**
A: Yes! A driver can be linked to multiple admins and switch between them in the app.

**Q: Is the QR code reusable?**
A: No, QR codes are single-use and expire after 24 hours for security.

**Q: What happens if driver loses/resets phone?**
A: Admin can generate a new QR code for re-authentication.

**Q: Can driver have different passwords for different admins?**
A: No, same email/password works for all linked admins. Can switch admin in app.

**Q: How long does admin approval take?**
A: Instant (admin controls). Auto-send SMS when approved.

**Q: Can driver see earnings from all admins?**
A: Currently, earnings are isolated per admin. Future: unified earnings dashboard.

---

## Support & Contact

For questions about this implementation, contact the development team.

**Last Updated**: 2026-07-29
**Version**: 1.0
**Status**: Ready for Implementation
