# Sunday Free Consult — System Design

## 1. Overview

Weekly free 10-minute consultations on Sundays (Asia/Karachi). Patients submit a request (no doctor picker); ops assigns an available doctor within 60 minutes. One free request per patient per week, no-show bans. Legacy slot templates remain for doctor capacity/admin tooling.

## 2. Data model

| Collection | Purpose |
|------------|---------|
| `SundaySlotTemplate` | Recurring rules per doctor (start/end, duration, max slots) |
| `SundaySlotInstance` | One doc per doctor per Sunday; **embedded slots[]** for atomic updates |
| `Appointment` | Confirmed booking (`type: sunday_free`) |
| `User` | `noShowCount`, `sundayBannedUntil`, `earlyAccessSunday` |

## 3. API endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/sunday/doctors` | Public | List Sunday doctors + availability |
| GET | `/api/v1/sunday/slots` | Public | Slots for doctor + date |
| GET | `/api/v1/sunday/events` | Public | SSE realtime stream |
| POST | `/api/v1/sunday/reserve` | Patient | Hold slot (5 min) |
| POST | `/api/v1/sunday/confirm` | Patient | Confirm booking |
| POST | `/api/v1/sunday/release` | Patient | Release hold |
| GET | `/api/v1/sunday/my-booking` | Patient | Current Sunday booking |
| PUT | `/api/v1/sunday/doctor/template` | Doctor | Upsert weekly template |
| PATCH | `/api/v1/sunday/doctor/toggle` | Doctor | Enable/disable Sunday |
| GET | `/api/v1/sunday/doctor/queue` | Doctor | Queue + slots |
| PATCH | `/api/v1/sunday/doctor/appointment-status` | Doctor | Complete / no-show |
| POST | `/api/internal/sunday/materialize` | Cron | Materialize 4 weeks |
| POST | `/api/internal/seed-sunday` | Dev | Demo doctors |

## 4. Realtime flow

```
reserve/confirm → SundayConsultService → publishSundayEvent()
  → EventEmitter room `sunday:{date}:{doctorId}`
  → GET /api/v1/sunday/events (SSE) → client refetch slots
```

Production: add Socket.io server with Redis adapter; same event payload.

## 5. Edge cases

| Case | Handling |
|------|----------|
| Double book | `findOneAndUpdate` with `slots.status: available` |
| One per patient/Sunday | Service check + partial unique index on Appointment (`patientId + sundayDateKey`) |
| Hold expiry | `releaseExpiredHolds()` on each request + cron |
| User banned | `sundayBannedUntil` / `noShowCount >= 3` |
| Early access | `earlyAccessSunday` opens booking 24h earlier |
| Full schedule | `isFull` when zero available slots |
| Doctor disables | `sundayConsultEnabled: false` excluded from list |
| No template | 404 until doctor saves template |

## 6. Reminders

`sendBookingConfirmation` → in-app `Notification` + SMS/WhatsApp logs when API keys set.

Cron (future): 24h / 1h / Sunday morning via `/api/internal/sunday/reminders`.
