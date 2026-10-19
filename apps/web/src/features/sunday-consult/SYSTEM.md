# Sunday Free Consult — System Design

## 1. Overview

Weekly free 10-minute consultations on Sundays (Asia/Karachi). Patients submit a request (no doctor picker). **Doctors pick requests themselves**: any verified doctor sees the open-requests board on `/doctor/sunday-consult`, picks a patient and chooses a time on that Sunday. The patient gets the consult free; the doctor earns the review. Admins only watch progress on `/admin/sunday-consult` (read-only, no assignment). One free request per patient per week, no-show bans. Legacy slot templates remain for doctor capacity/admin tooling.

Request lifecycle: `requested` → (doctor picks + time) `assigned` → `completed` / `cancelled`. A doctor may release an `assigned` request before the consult starts; it goes back to `requested` and the appointment is cancelled.

Closing a consult: video and chat stay open from the usual join-window opening (`VIDEO_CONSULT_CONFIG.joinEarlyMinutes` before the start) until the **doctor** presses "Finish consultation" (`PATCH /api/v1/sunday/doctor/appointment-status`). Leaving the call does not end it, and nothing auto-completes a Sunday consult. Only a completed consult can be reviewed. Finishing (or marking a no-show) closes the video session and the chat thread (unless the pair shares another open/paid consult) and notifies the patient to leave a review. The doctor-miss sweep still records a no-show if the doctor never joins.

Overdue requests: `requested` requests older than 7 days (no doctor ever picked them) also appear on the doctor board under "Waiting over a week". Picking one moves the request to the current board Sunday and schedules the consult there.

## 2. Data model

| Collection | Purpose |
|------------|---------|
| `SundaySlotTemplate` | Recurring rules per doctor (start/end, duration, max slots) |
| `SundaySlotInstance` | One doc per doctor per Sunday; **embedded slots[]** for atomic updates |
| `SundayFreeRequest` | Patient request; `assignedDoctorId` = the doctor who picked it |
| `Appointment` | Confirmed booking (`type: sunday_free`), created when a doctor picks a request |
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
| GET | `/api/v1/sunday/doctor/requests` | Doctor | Open requests + the doctor's own picks |
| POST | `/api/v1/sunday/doctor/requests/{id}/claim` | Doctor | Pick request at `startTimeLocal` (HH:mm PK) |
| POST | `/api/v1/sunday/doctor/requests/{id}/release` | Doctor | Hand a picked request back to the board |
| GET | `/api/v1/admin/sunday/requests` | Admin | Read-only request progress |
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
| Two doctors pick same patient | Atomic `requested → assigned` `findOneAndUpdate`; loser gets 409 |
| Doctor time clash | Overlap check on doctor's active appointments + unique `{doctorId, scheduledStart}` index |
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
