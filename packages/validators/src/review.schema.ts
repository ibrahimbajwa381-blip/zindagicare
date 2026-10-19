import { z } from "zod";

/** Patient submits a rating after a completed consultation. */
export const submitReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
});

export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;

/** Admin manually logs a review a patient left off-platform (e.g. via phone/WhatsApp). */
export const adminAddReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
  patientName: z.string().trim().min(2).max(100),
  reviewDate: z.coerce.date().optional(),
});

export type AdminAddReviewInput = z.infer<typeof adminAddReviewSchema>;

/** Patient rates ZindagiCare itself after a consult (stored as a Testimonial). */
export const submitPlatformReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
});

export type SubmitPlatformReviewInput = z.infer<typeof submitPlatformReviewSchema>;
