# ZindagiCare — MongoDB Schema Design

## Design principles

| Principle | Application |
|-----------|-------------|
| **Reference by default** | User ↔ Profile ↔ Appointment use `ObjectId` refs |
| **Embed when bounded** | Sunday slots (~20–100), order line items (~50), geo subdocs |
| **Never embed unbounded** | Chat messages, audit logs, notifications → separate collections |
| **Denormalize for read hot paths** | `DoctorProfile.ratingAvg`, `ChatThread.lastMessagePreview` |
| **Multi-role on User** | `roles[]` on User; role data in profile collections |
| **Soft delete** | `deletedAt` on user-facing entities |
| **PK timezone** | Store UTC `Date`; `timezone: Asia/Karachi` on scheduling entities |

## Entity relationship overview

```
User (roles[])
 ├── DoctorProfile (1:1 userId)
 ├── PatientProfile (1:1 userId)
 ├── StaffProfile (1:1 userId) — nurse | rider
 └── FamilyMember[] (headUserId)

SundaySlotTemplate → SundaySlotInstance (embedded slots[])
Appointment → refs patient, doctor, sunday instance, payment, homeVisit, video, chat
Review → appointment (unique), doctor, patient
Payment → user + one of appointment | homeVisit | order
```

## Embedded vs referenced

| Data | Strategy | Why |
|------|----------|-----|
| Sunday slots in instance | **Embedded** | Atomic book; bounded size; one read for UI |
| Chat messages | **Referenced** | Unbounded growth per thread |
| Order line items | **Embedded** | Cart-sized; snapshot prices at purchase |
| Hospital list on doctor | **Embedded** | Small (1–5); displayed on profile |
| User roles | **On User array** | Auth/middleware needs roles without join |
| PMDC / clinical on doctor | **DoctorProfile** | Keeps User document small for auth |

## Index strategy summary

See each model file. Critical compound indexes:

- `Appointment`: `{ patientId, scheduledStart, status }`, `{ doctorId, scheduledStart, status }`
- `SundaySlotInstance`: `{ doctorId, sundayDate }` unique
- `DoctorProfile`: `{ specialties, hospitals.city, isListed }`, `{ ratingAvg: -1 }`
- `HomeVisit`: `2dsphere` on `address.geo`
- `Payment`: `{ provider, externalTransactionId }` unique
- `Notification`: TTL 90d on `createdAt`

## Query patterns

| Use case | Collection | Query |
|----------|------------|-------|
| Doctor search Lahore | DoctorProfile | `{ isListed: true, specialties: {$in}, "hospitals.city": "Lahore" }.sort({ ratingAvg: -1 })` |
| Patient dashboard | Appointment | `{ patientId, scheduledStart: {$gte: now} }.sort({ scheduledStart: 1 })` |
| Doctor calendar | Appointment | `{ doctorId, scheduledStart: {$gte, $lte} }` |
| Sunday slot picker | SundaySlotInstance | `{ doctorId, sundayDate }.projection({ slots: 1 })` |
| Book Sunday slot | SundaySlotInstance | `findOneAndUpdate({ doctorId, sundayDate, "slots.slotId", "slots.status": "available" }, ...)` |
| One free Sunday rule | Appointment | Partial unique index on patient+doctor+type+sunday week |
| Home visits nearby | HomeVisit | `$near` on `address.geo` + `status` |
| In-app notifications | Notification | `{ userId, readAt: null }.sort({ createdAt: -1 }).limit(20)` |
| Chat history | ChatMessage | `{ threadId }.sort({ createdAt: -1 }).limit(50)` |
| Webhook idempotency | Payment | `{ idempotencyKey }` or `{ provider, externalTransactionId }` |
| Admin audit trail | AuditLog | `{ entityType, entityId }.sort({ createdAt: -1 })` |

## Multi-role users

- `User.roles` can include multiple values (e.g. `patient` + `doctor` after verification).
- Middleware checks `roles` from JWT (set at login from User).
- Creating a doctor adds `Roles.DOCTOR` and upserts `DoctorProfile`.
- Profiles are independent documents — deleting doctor role does not delete patient profile.

## Scalability notes

- Shard key candidate (future): `{ "metadata.city": 1, createdAt: 1 }` on high-volume collections.
- Archive appointments older than 2 years to `appointments_archive` via cron.
- Chat: consider bucket by `threadId` + `createdAt` month for very large threads.
- Sunday instances: one doc per doctor per week — scales linearly with doctors, not patients.
