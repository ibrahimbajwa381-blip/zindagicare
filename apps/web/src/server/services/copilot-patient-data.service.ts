import {
  AppointmentModel,
  connectDatabase,
  DoctorProfileModel,
} from "@zindagi/database";
import { AppointmentStatuses, AppointmentTypes } from "@zindagi/shared";
import { resolveDoctorPortrait } from "@/features/marketing/data/demo-doctor-images";
import { mongoFilter } from "@/lib/mongo/query";
import { mapUserPii } from "@/server/lib/decrypt-pii";
import { getPatientProfile } from "@/server/services/patient-profile.service";
import { PrescriptionService } from "@/server/services/prescription.service";

export type CopilotAppointmentPreview = {
  appointmentId: string;
  doctorName: string;
  specialty: string;
  scheduledStart: string;
  status: string;
  href: string;
};

export type CopilotPrescriptionPreview = {
  prescriptionId: string;
  doctorName: string;
  createdAt: string;
  href: string;
};

export class CopilotPatientDataService {
  static async listUpcomingAppointments(
    userId: string,
    limit = 5,
  ): Promise<CopilotAppointmentPreview[]> {
    await connectDatabase();
    const now = new Date();

    const rows = await AppointmentModel.find(
      mongoFilter({
        patientId: userId,
        deletedAt: null,
        status: {
          $in: [
            AppointmentStatuses.CONFIRMED,
            AppointmentStatuses.PENDING,
            AppointmentStatuses.IN_PROGRESS,
          ],
        },
        scheduledEnd: { $gte: now },
      }),
    )
      .sort({ scheduledStart: 1 })
      .limit(limit)
      .populate({
        path: "doctorId",
        select: "specialties slug",
        populate: { path: "userId", select: "name" },
      })
      .lean();

    return rows
      .map((row) => {
        const doctor = row.doctorId as {
          specialties?: string[];
          slug?: string;
          userId?: { name?: string };
        } | null;
        if (!doctor) return null;

        const doctorName = mapUserPii(doctor.userId ?? {}).name;
        return {
          appointmentId: row._id.toString(),
          doctorName,
          specialty: doctor.specialties?.[0] ?? "General Physician",
          scheduledStart: row.scheduledStart.toISOString(),
          status: String(row.status),
          href: "/dashboard",
        } satisfies CopilotAppointmentPreview;
      })
      .filter((row): row is CopilotAppointmentPreview => row !== null);
  }

  static async listPrescriptionPreviews(
    userId: string,
    limit = 5,
  ): Promise<CopilotPrescriptionPreview[]> {
    const rows = await PrescriptionService.listForPatient(userId);
    return rows.slice(0, limit).map((row) => ({
      prescriptionId: row.id,
      doctorName: row.doctorName,
      createdAt: row.issuedAt,
      href: row.downloadUrl || `/prescriptions/${row.id}`,
    }));
  }

  static async getHealthSummary(userId: string) {
    const profile = await getPatientProfile(userId);
    return {
      city: profile.user.city ?? "Lahore",
      allergies: profile.profile.allergies,
      chronicConditions: profile.profile.chronicConditions,
      emergencyContact: profile.profile.emergencyContact
        ? {
            name: profile.profile.emergencyContact.name,
            relation: profile.profile.emergencyContact.relation,
          }
        : undefined,
    };
  }

  static async resolveDoctorIdByName(
    city: string,
    nameQuery: string,
  ): Promise<string | undefined> {
    await connectDatabase();
    const query = nameQuery.trim().toLowerCase().replace(/^dr\.?\s*/i, "");
    if (!query) return undefined;

    const doctors = await DoctorProfileModel.find(
      mongoFilter({
        isListed: true,
        verificationStatus: "approved",
        coverageCities: city,
      }),
    )
      .populate("userId", "name")
      .limit(40)
      .lean();

    for (const doc of doctors) {
      const user = doc.userId as { name?: string } | null;
      const name = mapUserPii(user ?? {}).name.toLowerCase();
      if (
        name.includes(query) ||
        query.split(/\s+/).filter(Boolean).every((part) => name.includes(part))
      ) {
        return doc._id.toString();
      }
    }

    return undefined;
  }
}
