import { TestimonialModel, UserModel, connectDatabase } from "@zindagi/database";
import type {
  AdminAddTestimonialInput,
  PublicSubmitTestimonialInput,
  SubmitTestimonialInput,
} from "@zindagi/validators";
import { AppError, ErrorCodes } from "@zindagi/shared";
import { mongoFilter } from "@/lib/mongo/query";
import { CacheTags, cacheKey, cached } from "@/server/lib/cache";
import {
  deleteTestimonialAvatar,
  testimonialAvatarStorageKeyFromUrl,
} from "@/server/services/testimonial-avatar.storage";

export type PublicTestimonialDto = {
  id: string;
  patientName: string;
  patientTitle?: string;
  avatarUrl?: string;
  rating?: number;
  content: string;
  createdAt: string;
};

export type AdminTestimonialRow = {
  id: string;
  patientId?: string;
  patientName: string;
  patientTitle?: string;
  avatarUrl?: string;
  rating?: number;
  content: string;
  isVisible: boolean;
  createdAt: string;
  source: "patient" | "admin" | "public";
};

export class TestimonialService {
  static async ensureConnected() {
    await connectDatabase();
  }

  static async listPublic(limit = 12): Promise<PublicTestimonialDto[]> {
    return cached(
      cacheKey("testimonials", limit),
      { ttl: 600, tags: [CacheTags.TESTIMONIALS] },
      () => TestimonialService.loadPublic(limit),
    );
  }

  private static async loadPublic(limit: number): Promise<PublicTestimonialDto[]> {
    await TestimonialService.ensureConnected();

    const rows = await TestimonialModel.find(
      mongoFilter({ isVisible: true, deletedAt: null }),
    )
      .sort({ createdAt: -1 })
      .limit(Math.min(50, Math.max(1, limit)))
      .lean();

    return rows.map((row) => ({
      id: row._id.toString(),
      patientName: row.patientName,
      patientTitle: row.patientTitle ?? undefined,
      avatarUrl: row.avatarUrl ?? undefined,
      rating: row.rating ?? undefined,
      content: row.content,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  static async submitTestimonial(
    patientId: string,
    input: SubmitTestimonialInput,
  ): Promise<PublicTestimonialDto> {
    await TestimonialService.ensureConnected();

    const patient = await UserModel.findById(patientId).select("name").lean();
    if (!patient) {
      throw new AppError("Patient not found", ErrorCodes.NOT_FOUND, 404);
    }

    const testimonial = await TestimonialModel.create({
      patientId,
      patientName: patient.name ?? "Patient",
      rating: input.rating,
      content: input.content.trim(),
      source: "patient",
      isVisible: true,
    } as Record<string, unknown>);

    return {
      id: testimonial._id.toString(),
      patientName: testimonial.patientName,
      rating: testimonial.rating ?? undefined,
      content: testimonial.content,
      createdAt: testimonial.createdAt.toISOString(),
    };
  }

  /** Anyone with the shareable link submits a review — no account, goes live immediately. */
  static async submitPublicTestimonial(
    input: PublicSubmitTestimonialInput,
  ): Promise<PublicTestimonialDto> {
    await TestimonialService.ensureConnected();

    const testimonial = await TestimonialModel.create({
      patientName: input.patientName.trim(),
      patientTitle: input.patientTitle?.trim() || undefined,
      avatarUrl: input.avatarUrl?.trim() || undefined,
      rating: input.rating,
      content: input.content.trim(),
      source: "public",
      isVisible: true,
    } as Record<string, unknown>);

    return {
      id: testimonial._id.toString(),
      patientName: testimonial.patientName,
      patientTitle: testimonial.patientTitle ?? undefined,
      avatarUrl: testimonial.avatarUrl ?? undefined,
      rating: testimonial.rating ?? undefined,
      content: testimonial.content,
      createdAt: testimonial.createdAt.toISOString(),
    };
  }

  /** Admin logs a testimonial a patient shared off-platform (phone/WhatsApp/in person). */
  static async adminAddTestimonial(
    adminUserId: string,
    input: AdminAddTestimonialInput,
  ): Promise<AdminTestimonialRow> {
    await TestimonialService.ensureConnected();

    const testimonial = await TestimonialModel.create({
      patientName: input.patientName.trim(),
      patientTitle: input.patientTitle?.trim() || undefined,
      avatarUrl: input.avatarUrl?.trim() || undefined,
      rating: input.rating,
      content: input.content.trim(),
      source: "admin",
      isVisible: true,
      moderatedBy: adminUserId,
      createdAt: input.testimonialDate ?? new Date(),
    } as Record<string, unknown>);

    return {
      id: testimonial._id.toString(),
      patientName: testimonial.patientName,
      patientTitle: testimonial.patientTitle ?? undefined,
      avatarUrl: testimonial.avatarUrl ?? undefined,
      rating: testimonial.rating ?? undefined,
      content: testimonial.content,
      isVisible: testimonial.isVisible ?? true,
      createdAt: testimonial.createdAt.toISOString(),
      source: "admin",
    };
  }

  static async listAdmin(
    options: { visibility?: "visible" | "hidden" | "all" } = {},
  ): Promise<{ testimonials: AdminTestimonialRow[]; total: number }> {
    await TestimonialService.ensureConnected();

    const visibility = options.visibility ?? "all";
    const filter = mongoFilter({
      deletedAt: null,
      ...(visibility === "visible" ? { isVisible: true } : {}),
      ...(visibility === "hidden" ? { isVisible: false } : {}),
    });

    const [rows, total] = await Promise.all([
      TestimonialModel.find(filter).sort({ createdAt: -1 }).limit(200).lean(),
      TestimonialModel.countDocuments(filter),
    ]);

    const testimonials: AdminTestimonialRow[] = rows.map((row) => ({
      id: row._id.toString(),
      patientId: row.patientId?.toString(),
      patientName: row.patientName,
      patientTitle: row.patientTitle ?? undefined,
      avatarUrl: row.avatarUrl ?? undefined,
      rating: row.rating ?? undefined,
      content: row.content,
      isVisible: row.isVisible ?? true,
      createdAt: row.createdAt.toISOString(),
      source: (row.source as "patient" | "admin" | "public") ?? "patient",
    }));

    return { testimonials, total };
  }

  static async moderate(
    adminUserId: string,
    testimonialId: string,
    action: "hide" | "show" | "delete",
  ) {
    await TestimonialService.ensureConnected();

    const testimonial = await TestimonialModel.findOne(
      mongoFilter({ _id: testimonialId, deletedAt: null }),
    );
    if (!testimonial) {
      throw new AppError("Testimonial not found", ErrorCodes.NOT_FOUND, 404);
    }

    if (action === "hide") {
      testimonial.isVisible = false;
      testimonial.moderatedBy = adminUserId as never;
    } else if (action === "show") {
      testimonial.isVisible = true;
      testimonial.moderatedBy = adminUserId as never;
    } else {
      testimonial.deletedAt = new Date();
      testimonial.isVisible = false;
      testimonial.moderatedBy = adminUserId as never;
    }
    await testimonial.save();

    if (action === "delete" && testimonial.avatarUrl) {
      const storageKey = testimonialAvatarStorageKeyFromUrl(testimonial.avatarUrl);
      if (storageKey) {
        try {
          await deleteTestimonialAvatar(storageKey);
        } catch {
          // best-effort cleanup; ignore failures (e.g., file already removed)
        }
      }
    }

    return {
      id: testimonial._id.toString(),
      isVisible: testimonial.isVisible,
      deleted: Boolean(testimonial.deletedAt),
    };
  }
}
