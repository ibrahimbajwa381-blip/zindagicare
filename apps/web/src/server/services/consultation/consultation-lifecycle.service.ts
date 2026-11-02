import { AppointmentModel, connectDatabase } from "@zindagi/database";
import { AppError, AppointmentStatuses, AppointmentTypes, ErrorCodes } from "@zindagi/shared";
import { Types } from "mongoose";
import { mongoFilter } from "@/lib/mongo/query";
import { deliverUserNotification } from "@/lib/notifications/deliver-notification";
import { CARE_GRACE_MS } from "@/server/services/care/policy";
import {
  canFinishConsult,
  FINISHABLE_TYPES,
  OPEN_CONSULT_STATUSES as OPEN_STATUSES,
} from "@/server/services/consultation/finish-policy";
import {
  providerUserIdOf,
  type AppointmentProviderRef,
} from "@/server/services/care/provider-registry";
import { SundayConsultService } from "@/server/services/sunday-consult.service";
import { UrgentConsultService } from "@/server/services/urgent-consult.service";
import { VideoSessionService } from "@/server/services/video-session.service";

/**
 * One way to end an online consult, for every type (paid, urgent, Sunday free)
 * and every provider role: the provider presses Finish, the patient presses
 * Complete, or the daily sweep
 * completes an attended consult left open past the grace period. Leaving the
 * call, issuing a prescription or posting a review never ends a consult.
 * Chat access follows the appointment status on its own (care policy).
 */

export type ConsultOutcome = "completed" | "no_show";

/** Bounds one sweep run; leftovers are picked up by the next run. */
const STALE_SWEEP_LIMIT = 500;

type ConsultRow = AppointmentProviderRef & {
  _id: { toString(): string };
  patientId: { toString(): string };
  type: string;
  status: string;
  scheduledStart: Date;
  sundaySlotInstanceId?: { toString(): string } | null;
  sundaySlotId?: string | null;
};

/** Type-specific follow-up owned by each consult type's own service. */
const AFTER_CLOSE: Partial<Record<string, (consult: ConsultRow, outcome: ConsultOutcome) => Promise<unknown>>> = {
  [AppointmentTypes.SUNDAY_FREE]: (consult, outcome) =>
    SundayConsultService.onConsultClosed(consult, outcome),
  [AppointmentTypes.URGENT_ONLINE]: (consult) =>
    UrgentConsultService.tryCompleteByAppointmentId(consult._id.toString()),
};

export class ConsultationLifecycleService {
  /**
   * Provider ends their own consult as completed or patient no-show; the
   * patient may also mark their own consult completed (never no-show).
   */
  static async finish(
    appointmentId: string,
    userId: string,
    outcome: ConsultOutcome,
    doctorNotes?: string,
  ): Promise<{ status: string }> {
    await connectDatabase();

    const consult = Types.ObjectId.isValid(appointmentId)
      ? await AppointmentModel.findById(appointmentId).lean()
      : null;
    const providerUserId = consult ? await providerUserIdOf(consult) : null;
    const byPatient = Boolean(consult && consult.patientId.toString() === userId);
    if (!consult || (providerUserId !== userId && !byPatient)) {
      throw new AppError("Appointment not found", ErrorCodes.NOT_FOUND, 404);
    }
    if (byPatient && outcome !== "completed") {
      throw new AppError("Only your doctor can mark a no-show.", ErrorCodes.FORBIDDEN, 403);
    }
    if (!FINISHABLE_TYPES.includes(consult.type)) {
      throw new AppError("Only online consultations are finished here.", ErrorCodes.VALIDATION, 400);
    }
    if (!(OPEN_STATUSES as readonly string[]).includes(consult.status)) {
      throw new AppError("This consultation is already closed.", ErrorCodes.VALIDATION, 400);
    }
    if (!canFinishConsult(consult)) {
      throw new AppError(
        "You can finish this consultation once it has started.",
        ErrorCodes.VALIDATION,
        400,
      );
    }

    const closed = byPatient
      ? await ConsultationLifecycleService.close(consult, outcome, undefined, providerUserId)
      : await ConsultationLifecycleService.close(consult, outcome, doctorNotes);
    if (!closed) {
      throw new AppError("This consultation is already closed.", ErrorCodes.VALIDATION, 400);
    }
    return {
      status: outcome === "completed" ? AppointmentStatuses.COMPLETED : AppointmentStatuses.NO_SHOW,
    };
  }

  /**
   * Fallback for consults the provider never finished: once past the grace
   * period, attended ones are completed. Unattended ones are left to the
   * doctor-miss sweep. Run from the daily appointments cron.
   */
  static async finalizeStale(now = new Date()): Promise<{ scanned: number; completed: number }> {
    await connectDatabase();

    const stale = await AppointmentModel.find(
      mongoFilter({
        type: { $in: FINISHABLE_TYPES },
        status: { $in: OPEN_STATUSES },
        scheduledEnd: { $lte: new Date(now.getTime() - CARE_GRACE_MS) },
        deletedAt: null,
      }),
    )
      .sort({ scheduledEnd: 1 })
      .limit(STALE_SWEEP_LIMIT)
      .lean();

    let completed = 0;
    for (const consult of stale) {
      if (!(await VideoSessionService.wasAttended(consult._id.toString()))) continue;
      if (await ConsultationLifecycleService.close(consult, "completed")) completed += 1;
    }
    return { scanned: stale.length, completed };
  }

  /**
   * Moves an open consult to its outcome once; false when it was already closed.
   * `notifyProviderUserId` is set when the patient closed it: the provider is told instead.
   */
  private static async close(
    consult: ConsultRow,
    outcome: ConsultOutcome,
    doctorNotes?: string,
    notifyProviderUserId?: string | null,
  ): Promise<boolean> {
    const now = new Date();
    const result = await AppointmentModel.updateOne(
      mongoFilter({ _id: consult._id, status: { $in: OPEN_STATUSES } }),
      {
        $set: {
          ...(outcome === "completed"
            ? { status: AppointmentStatuses.COMPLETED, completedAt: now }
            : { status: AppointmentStatuses.NO_SHOW, noShowMarkedAt: now, missedBy: "patient" }),
          ...(doctorNotes ? { doctorNotes } : {}),
        },
      },
    );
    if (result.modifiedCount === 0) return false;

    const appointmentId = consult._id.toString();
    await VideoSessionService.endSession(appointmentId);
    await AFTER_CLOSE[consult.type]?.(consult, outcome).catch((error: unknown) => {
      console.error("[consultation] after-close step failed", {
        appointmentId,
        type: consult.type,
        error: error instanceof Error ? error.name : "unknown",
      });
    });

    if (outcome === "completed") {
      await deliverUserNotification(
        notifyProviderUserId
          ? {
              userId: notifyProviderUserId,
              title: "Consultation marked complete",
              body: "Your patient has marked the consultation as complete.",
              payload: { type: "consult_completed", appointmentId },
            }
          : {
              userId: consult.patientId.toString(),
              title: "Your consultation is complete",
              body: "Your doctor has finished your consultation. Please take a moment to rate your doctor.",
              payload: { type: "consult_completed", appointmentId },
            },
      ).catch((error: unknown) => {
        console.error("[consultation] completion notification failed", {
          appointmentId,
          error: error instanceof Error ? error.name : "unknown",
        });
      });
    }
    return true;
  }
}
