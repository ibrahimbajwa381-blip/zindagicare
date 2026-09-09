/**
 * REAL MongoDB concurrency test — no mocks, no Atlas.
 *
 * Spins up an actual local mongod (via mongodb-memory-server, an ephemeral
 * throwaway instance — never Atlas, never production), connects the real
 * @zindagi/database models to it (so every real index gets built fresh), and
 * fires genuinely concurrent requests at the real service functions to
 * answer one question: can two real concurrent requests leave an appointment
 * in a corrupted/inconsistent state?
 *
 * Run: npx tsx scripts/real-mongo-concurrency-test.ts   (from apps/web)
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes } from "crypto";

type Counts = Record<string, number>;

function tally(counts: Counts, key: string) {
  counts[key] = (counts[key] ?? 0) + 1;
}

async function main() {
  console.log("Starting ephemeral local MongoDB (mongodb-memory-server)...");
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri("zindagi_concurrency_test");
  // Ephemeral throwaway key for this ephemeral throwaway database only — the
  // User model's field-encryption plugin requires one to write encrypted
  // fields (email/phone). Never reuses or touches the real app's key.
  process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  console.log("Local MongoDB URI:", process.env.MONGODB_URI);

  const {
    connectDatabase,
    AppointmentModel,
    PaymentModel,
    UserModel,
    DoctorProfileModel,
    VideoSessionModel,
  } = await import("@zindagi/database");
  const mongooseMod = (await import("mongoose")).default;
  const {
    AppointmentStatuses,
    AppointmentTypes,
    PaymentStatuses,
    PaymentProviders,
    VerificationStatuses,
    VideoSessionStatuses,
  } = await import("@zindagi/shared");

  await connectDatabase();
  console.log("Connected. Waiting for indexes to build...");
  await AppointmentModel.init();
  await PaymentModel.init();
  console.log("Indexes ready.\n");

  const { OnlineConsultService } = await import("@/server/services/online-consult.service");
  const { VideoSessionService } = await import("@/server/services/video-session.service");
  const { PatientAppointmentsService } = await import("@/server/services/patient-appointments.service");
  const { adminCancelAppointment } = await import("@/server/services/admin-appointment.service");

  // --- Fixed seed actors, reused across every trial ---
  const patient = await UserModel.create({
    name: "Race Patient",
    email: `race-patient-${Date.now()}@example.com`,
    phone: `+9230010${Math.floor(Math.random() * 90000 + 10000)}`,
    roles: ["patient"],
    isActive: true,
  });
  const doctorUser = await UserModel.create({
    name: "Race Doctor",
    email: `race-doctor-${Date.now()}@example.com`,
    phone: `+9230011${Math.floor(Math.random() * 90000 + 10000)}`,
    roles: ["doctor"],
    isActive: true,
  });
  const doctorProfile = await DoctorProfileModel.create({
    userId: doctorUser._id,
    isListed: true,
    verificationStatus: VerificationStatuses.APPROVED,
    consultationFee: 1500,
    specialties: ["General Physician"],
    coverageCities: ["Lahore"],
    weeklyAvailability: Array.from({ length: 7 }, (_, dayOfWeek) => ({
      dayOfWeek,
      startTimeLocal: "00:00",
      endTimeLocal: "23:40",
    })),
  });

  let slotCounter = 0;
  function nextSlot() {
    // Each trial gets its own far-future slot so the doctor-slot unique index
    // never collides between trials.
    slotCounter += 1;
    const start = new Date(Date.now() + (365 + slotCounter) * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 20 * 60 * 1000);
    return { start, end };
  }

  async function seedAppointment(status: string, extra: Record<string, unknown> = {}) {
    const { start, end } = nextSlot();
    const appointment = await AppointmentModel.create({
      type: AppointmentTypes.ONLINE,
      status,
      patientId: patient._id,
      doctorId: doctorProfile._id,
      scheduledStart: start,
      scheduledEnd: end,
      timezone: "Asia/Karachi",
      isOnline: true,
      ...extra,
    });
    return appointment;
  }

  async function seedPayment(appointmentId: unknown, status: string) {
    return PaymentModel.create({
      userId: patient._id,
      provider: PaymentProviders.MANUAL_JAZZCASH,
      status,
      amount: 1500,
      currency: "PKR",
      idempotencyKey: `race-${Date.now()}-${Math.random()}`,
      externalTransactionId: `RACE-TXN-${Date.now()}-${Math.random()}`,
      appointmentId,
    });
  }

  async function readFinal(appointmentId: unknown) {
    return AppointmentModel.findById(appointmentId).lean();
  }

  // ===========================================================================
  // SCENARIO 1 — PENDING -> CONFIRMED (confirmAfterPayment) racing
  //              PENDING -> CANCELLED (failPayment) on the SAME appointment
  // ===========================================================================
  async function scenario1(trials: number) {
    console.log(`\n=== SCENARIO 1: confirmAfterPayment vs failPayment race (${trials} trials) ===`);
    const outcomes: Counts = {};
    let inconsistentCount = 0;

    for (let i = 0; i < trials; i++) {
      const appointment = await seedAppointment(AppointmentStatuses.PENDING);
      const payment = await seedPayment(appointment._id, PaymentStatuses.PENDING);
      // Real initiateCheckout links paymentId onto the appointment at
      // creation time — replicate that so downstream checks (e.g. chat
      // eligibility) see the same shape a real booking would.
      await AppointmentModel.updateOne({ _id: appointment._id }, { $set: { paymentId: payment._id } });

      const results = await Promise.allSettled([
        OnlineConsultService.confirmAfterPayment(payment._id.toString(), `RACE-TXN-EXT-${Date.now()}-${Math.random()}`),
        OnlineConsultService.failPayment(payment._id.toString(), "race_test_decline"),
      ]);

      const finalAppointment = await readFinal(appointment._id);
      const finalPayment = await PaymentModel.findById(payment._id).lean();

      const confirmOutcome = results[0].status;
      const failOutcome = results[1].status;
      const key = `confirm=${confirmOutcome} fail=${failOutcome} -> appt=${finalAppointment?.status} payment=${finalPayment?.status}`;
      tally(outcomes, key);

      // Flag the specific anomaly: confirmAfterPayment's promise rejected,
      // yet its own critical writes (payment PAID / appointment CONFIRMED)
      // landed anyway — meaning something AFTER those writes threw.
      if (
        confirmOutcome === "rejected" &&
        finalPayment?.status === PaymentStatuses.PAID &&
        finalAppointment?.status === AppointmentStatuses.CONFIRMED
      ) {
        const reason = (results[0] as PromiseRejectedResult).reason;
        console.log(`  >>> ANOMALY trial ${i}: confirmAfterPayment REJECTED but its critical writes committed anyway.`);
        console.log(`      Rejection was:`, reason instanceof Error ? reason.stack ?? reason.message : reason);
      }

      // The dangerous case: payment shows PAID but appointment shows CANCELLED
      // (patient paid, got charged, but the system thinks the slot is free/cancelled)
      // or the reverse (appointment CONFIRMED but payment not PAID).
      const inconsistent =
        (finalPayment?.status === PaymentStatuses.PAID && finalAppointment?.status === AppointmentStatuses.CANCELLED) ||
        (finalAppointment?.status === AppointmentStatuses.CONFIRMED && finalPayment?.status !== PaymentStatuses.PAID);
      if (inconsistent) inconsistentCount++;
    }

    console.log("Outcome distribution:");
    for (const [key, count] of Object.entries(outcomes)) {
      console.log(`  ${count.toString().padStart(3)}x  ${key}`);
    }
    console.log(`Inconsistent (payment/appointment mismatch) trials: ${inconsistentCount} / ${trials}`);
    return { outcomes, inconsistentCount };
  }

  // ===========================================================================
  // SCENARIO 1b — same race as Scenario 1, but with an artificial delay
  // injected into every PaymentModel.findById().lean() call (both racers'
  // very first step) to deliberately widen the read/write window. Scenario 1
  // showed failPayment's simpler write path naturally winning every time on
  // fast local I/O, masking the narrower window where BOTH confirmAfterPayment
  // and failPayment read payment.status=PENDING before either has written —
  // at which point BOTH would pass their guards and BOTH would proceed to
  // write, since neither write is conditioned on the payment's status at
  // write time. This forces that window open to get a real answer instead of
  // an absence-of-evidence one.
  // ===========================================================================
  async function scenario1b(trials: number, delayMs: number) {
    console.log(
      `\n=== SCENARIO 1b: confirmAfterPayment vs failPayment, with a forced ${delayMs}ms read/write window (${trials} trials) ===`,
    );

    // Delay the WRITES (not the reads) on both models — this is what actually
    // widens the "both readers saw the pre-write value" window, since both
    // confirmAfterPayment's and failPayment's reads can then complete at
    // near-native speed (both observing PENDING) before either write lands.
    const originalPaymentUpdateOne = PaymentModel.updateOne.bind(PaymentModel);
    const originalAppointmentUpdateOne = AppointmentModel.updateOne.bind(AppointmentModel);
    (PaymentModel as unknown as { updateOne: unknown }).updateOne = (async (...args: unknown[]) => {
      await new Promise((r) => setTimeout(r, delayMs));
      return (originalPaymentUpdateOne as (...a: unknown[]) => Promise<unknown>)(...args);
    }) as typeof PaymentModel.updateOne;
    (AppointmentModel as unknown as { updateOne: unknown }).updateOne = (async (...args: unknown[]) => {
      await new Promise((r) => setTimeout(r, delayMs));
      return (originalAppointmentUpdateOne as (...a: unknown[]) => Promise<unknown>)(...args);
    }) as typeof AppointmentModel.updateOne;

    const outcomes: Counts = {};
    let inconsistentCount = 0;
    let bothProceededPastGuard = 0;

    try {
      for (let i = 0; i < trials; i++) {
        const appointment = await seedAppointment(AppointmentStatuses.PENDING);
        const payment = await seedPayment(appointment._id, PaymentStatuses.PENDING);
        await AppointmentModel.updateOne({ _id: appointment._id }, { $set: { paymentId: payment._id } });

        const results = await Promise.allSettled([
          OnlineConsultService.confirmAfterPayment(payment._id.toString(), `RACE-TXN-EXT-${Date.now()}-${Math.random()}`),
          OnlineConsultService.failPayment(payment._id.toString(), "race_test_decline"),
        ]);

        const finalAppointment = await readFinal(appointment._id);
        const finalPayment = await PaymentModel.findById(payment._id).lean();
        // (this readback also goes through the patched findById, but that's
        // fine — the delay only affects timing, not correctness of the read)

        const key = `confirm=${results[0].status} fail=${results[1].status} -> appt=${finalAppointment?.status} payment=${finalPayment?.status}`;
        tally(outcomes, key);

        if (i === 0 && results[0].status === "rejected") {
          const reason = (results[0] as PromiseRejectedResult).reason;
          console.log(
            `  [trial 0 rejection detail]`,
            reason instanceof Error ? `${reason.constructor.name}: ${reason.message}` : reason,
          );
        }

        if (results[0].status === "fulfilled" && results[1].status === "fulfilled") {
          bothProceededPastGuard++;
        }

        const inconsistent =
          (finalPayment?.status === PaymentStatuses.PAID && finalAppointment?.status === AppointmentStatuses.CANCELLED) ||
          (finalPayment?.status === PaymentStatuses.FAILED && finalAppointment?.status === AppointmentStatuses.CONFIRMED) ||
          (finalAppointment?.status === AppointmentStatuses.CONFIRMED && finalPayment?.status !== PaymentStatuses.PAID);
        if (inconsistent) {
          inconsistentCount++;
          console.log(`  >>> INCONSISTENT trial ${i}: appt=${finalAppointment?.status} payment=${finalPayment?.status}`);
        }
      }
    } finally {
      (PaymentModel as unknown as { updateOne: unknown }).updateOne = originalPaymentUpdateOne;
      (AppointmentModel as unknown as { updateOne: unknown }).updateOne = originalAppointmentUpdateOne;
    }

    console.log("Outcome distribution:");
    for (const [key, count] of Object.entries(outcomes)) {
      console.log(`  ${count.toString().padStart(3)}x  ${key}`);
    }
    console.log(`Both racers proceeded past their guard (forced double-write): ${bothProceededPastGuard} / ${trials}`);
    console.log(`Inconsistent final DB state: ${inconsistentCount} / ${trials}`);
    return { outcomes, inconsistentCount, bothProceededPastGuard };
  }

  // ===========================================================================
  // SCENARIO 2 — CONFIRMED -> IN_PROGRESS (recordJoin) racing
  //              CONFIRMED -> CANCELLED (patient requestCancellation)
  // ===========================================================================
  async function scenario2(trials: number) {
    console.log(`\n=== SCENARIO 2: recordJoin vs requestCancellation race (${trials} trials) ===`);
    const outcomes: Counts = {};

    for (let i = 0; i < trials; i++) {
      const appointment = await seedAppointment(AppointmentStatuses.CONFIRMED);
      await VideoSessionModel.create({
        appointmentId: appointment._id.toString(),
        channelName: `race-${i}`,
        provider: "zoom",
        status: VideoSessionStatuses.WAITING,
        metadata: { meetingId: 1, passcode: "x", joinUrl: "http://x" },
      });

      const results = await Promise.allSettled([
        VideoSessionService.recordJoin(patient._id.toString(), appointment._id.toString()),
        PatientAppointmentsService.requestCancellation(appointment._id.toString(), patient._id.toString(), {
          reason: "race test",
          refundMethod: "bank",
          refundAccountTitle: "Race Patient",
          refundAccountNumber: "1234567890",
        }),
      ]);

      const finalAppointment = await readFinal(appointment._id);
      const key = `join=${results[0].status} cancel=${results[1].status} -> appt=${finalAppointment?.status}`;
      tally(outcomes, key);
    }

    console.log("Outcome distribution:");
    for (const [key, count] of Object.entries(outcomes)) {
      console.log(`  ${count.toString().padStart(3)}x  ${key}`);
    }
    // A CANCELLED appointment that ends up IN_PROGRESS (or vice versa lost the
    // cancellation) is the corruption we're checking for.
    const badFinal = Object.keys(outcomes).filter(
      (k) => !k.includes("appt=cancelled") && !k.includes("appt=in_progress"),
    );
    console.log(`Unexpected final states: ${badFinal.length ? badFinal.join(", ") : "none"}`);
    return outcomes;
  }

  // ===========================================================================
  // SCENARIO 3 — IN_PROGRESS -> COMPLETED (recordLeave) racing
  //              IN_PROGRESS -> CANCELLED (admin cancel)
  // ===========================================================================
  async function scenario3(trials: number) {
    console.log(`\n=== SCENARIO 3: recordLeave vs adminCancelAppointment race (${trials} trials) ===`);
    const outcomes: Counts = {};
    const admin = await UserModel.create({
      name: "Race Admin",
      email: `race-admin-${Date.now()}-${Math.random()}@example.com`,
      phone: `+9230012${Math.floor(Math.random() * 90000 + 10000)}`,
      roles: ["admin"],
      isActive: true,
    });

    for (let i = 0; i < trials; i++) {
      const appointment = await seedAppointment(AppointmentStatuses.IN_PROGRESS);
      await VideoSessionModel.create({
        appointmentId: appointment._id.toString(),
        channelName: `race-leave-${i}`,
        provider: "zoom",
        status: VideoSessionStatuses.ACTIVE,
        patientJoinedAt: new Date(Date.now() - 5 * 60 * 1000),
        startedAt: new Date(Date.now() - 5 * 60 * 1000),
        metadata: { meetingId: 1, passcode: "x", joinUrl: "http://x" },
      });

      const results = await Promise.allSettled([
        VideoSessionService.recordLeave(patient._id.toString(), appointment._id.toString()),
        adminCancelAppointment(appointment._id.toString(), admin._id.toString(), "race test cancel"),
      ]);

      const finalAppointment = await readFinal(appointment._id);
      const key = `leave=${results[0].status} adminCancel=${results[1].status} -> appt=${finalAppointment?.status}`;
      tally(outcomes, key);
    }

    console.log("Outcome distribution:");
    for (const [key, count] of Object.entries(outcomes)) {
      console.log(`  ${count.toString().padStart(3)}x  ${key}`);
    }
    return outcomes;
  }

  // ===========================================================================
  // SCENARIO 4 — N-way concurrent IDENTICAL recordJoin calls (idempotency
  // under real concurrency, not mocks)
  // ===========================================================================
  async function scenario4(n: number) {
    console.log(`\n=== SCENARIO 4: ${n}-way concurrent identical recordJoin calls ===`);
    const appointment = await seedAppointment(AppointmentStatuses.CONFIRMED);
    await VideoSessionModel.create({
      appointmentId: appointment._id.toString(),
      channelName: `race-n-${n}`,
      provider: "zoom",
      status: VideoSessionStatuses.WAITING,
      metadata: { meetingId: 1, passcode: "x", joinUrl: "http://x" },
    });

    const start = Date.now();
    const results = await Promise.allSettled(
      Array.from({ length: n }, () =>
        VideoSessionService.recordJoin(patient._id.toString(), appointment._id.toString()),
      ),
    );
    const elapsed = Date.now() - start;

    const fulfilled = results.filter((r) => r.status === "fulfilled").length;
    const rejected = results.filter((r) => r.status === "rejected").length;
    const finalAppointment = await readFinal(appointment._id);
    const finalSession = await VideoSessionModel.findOne({
      appointmentId: appointment._id.toString(),
    }).lean();

    console.log(
      `  n=${n}: fulfilled=${fulfilled} rejected=${rejected} elapsed=${elapsed}ms final_appt_status=${finalAppointment?.status} final_session_status=${finalSession?.status}`,
    );
    if (rejected > 0) {
      const firstRejection = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
      console.log(`  first rejection reason:`, firstRejection.reason);
    }
    const corrupted = finalAppointment?.status !== AppointmentStatuses.IN_PROGRESS;
    console.log(`  Corrupted final state? ${corrupted}`);
    return { n, fulfilled, rejected, elapsed, finalStatus: finalAppointment?.status, corrupted };
  }

  // ===========================================================================
  // SCENARIO 5 — Raw TOCTOU demonstration: two manual read-then-conditional-
  // write flows racing on the same document, using the EXACT vulnerable
  // pattern (read, check in JS, unconditional updateOne by _id only) vs the
  // FIXED pattern (atomic updateOne with the expected prior status in the
  // filter) — to show definitively whether MongoDB's own atomicity guarantees
  // save the non-atomic version, or whether it's a genuine bug.
  // ===========================================================================
  async function scenario5(trials: number) {
    console.log(`\n=== SCENARIO 5: raw TOCTOU pattern — non-atomic vs atomic write (${trials} trials) ===`);

    async function nonAtomicTransition(id: unknown, expected: string, target: string) {
      const doc = await AppointmentModel.findById(id).lean();
      if (doc?.status === expected) {
        // Artificial delay to widen the race window and force interleaving —
        // without this, both operations often complete too fast on a local
        // memory-server mongod to ever interleave, masking the bug.
        await new Promise((r) => setTimeout(r, 5 + Math.random() * 10));
        await AppointmentModel.updateOne({ _id: id }, { $set: { status: target } });
        return true;
      }
      return false;
    }

    async function atomicTransition(id: unknown, expected: string, target: string) {
      const result = await AppointmentModel.updateOne(
        { _id: id, status: expected },
        { $set: { status: target } },
      );
      return result.modifiedCount === 1;
    }

    let nonAtomicBothSucceeded = 0;
    let nonAtomicLostUpdates = 0;
    let atomicBothSucceeded = 0;

    for (let i = 0; i < trials; i++) {
      // --- non-atomic version ---
      const apptA = await seedAppointment(AppointmentStatuses.PENDING);
      const [aConfirm, aCancel] = await Promise.all([
        nonAtomicTransition(apptA._id, AppointmentStatuses.PENDING, AppointmentStatuses.CONFIRMED),
        nonAtomicTransition(apptA._id, AppointmentStatuses.PENDING, AppointmentStatuses.CANCELLED),
      ]);
      if (aConfirm && aCancel) {
        nonAtomicBothSucceeded++;
        nonAtomicLostUpdates++; // both "succeeded" in JS terms but only one status can be true in the DB — the loser's business logic (e.g. side effects) already ran as if it won
      }

      // --- atomic version (the recommended fix pattern) ---
      const apptB = await seedAppointment(AppointmentStatuses.PENDING);
      const [bConfirm, bCancel] = await Promise.all([
        atomicTransition(apptB._id, AppointmentStatuses.PENDING, AppointmentStatuses.CONFIRMED),
        atomicTransition(apptB._id, AppointmentStatuses.PENDING, AppointmentStatuses.CANCELLED),
      ]);
      if (bConfirm && bCancel) atomicBothSucceeded++; // should NEVER happen
    }

    console.log(`Non-atomic pattern: both branches believed they succeeded in ${nonAtomicBothSucceeded}/${trials} trials`);
    console.log(`  -> this means ${nonAtomicLostUpdates}/${trials} trials ran BOTH sets of side effects`);
    console.log(`  -> (e.g. both a "you're confirmed" AND a "you're cancelled" notification would fire)`);
    console.log(`Atomic pattern: both branches succeeded in ${atomicBothSucceeded}/${trials} trials (must be 0)`);

    return { nonAtomicBothSucceeded, nonAtomicLostUpdates, atomicBothSucceeded, trials };
  }

  // ---------------------------------------------------------------------------
  // Run everything
  // ---------------------------------------------------------------------------
  const s1 = await scenario1(50);
  const s1b = await scenario1b(30, 20);
  const s2 = await scenario2(20);
  const s3 = await scenario3(20);
  const s4results = [];
  for (const n of [10, 25, 50, 100]) {
    s4results.push(await scenario4(n));
  }
  const s5 = await scenario5(30);

  console.log("\n\n===================== SUMMARY =====================");
  console.log(JSON.stringify({ s1, s1b, s2, s3, s4results, s5 }, null, 2));

  await mongooseMod.disconnect();
  await mongod.stop();
  console.log("\nDone. Ephemeral MongoDB stopped and discarded.");
}

main().catch(async (e) => {
  console.error("SCRIPT ERROR:", e);
  process.exit(1);
});
