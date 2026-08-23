import { z } from "zod";

/** Patient shares a general experience testimonial — goes live immediately. */
export const submitTestimonialSchema = z.object({
  content: z.string().trim().min(10).max(3000),
  rating: z.number().int().min(1).max(5).optional(),
});

export type SubmitTestimonialInput = z.infer<typeof submitTestimonialSchema>;

/** Admin manually adds a testimonial on behalf of any patient. */
export const adminAddTestimonialSchema = z.object({
  content: z.string().trim().min(10).max(3000),
  rating: z.number().int().min(1).max(5).optional(),
  patientName: z.string().trim().min(2).max(100),
  testimonialDate: z.coerce.date().optional(),
});

export type AdminAddTestimonialInput = z.infer<typeof adminAddTestimonialSchema>;

export const adminTestimonialModerationSchema = z.object({
  testimonialId: z.string().min(1),
  action: z.enum(["hide", "show", "delete"]),
});

export type AdminTestimonialModerationInput = z.infer<typeof adminTestimonialModerationSchema>;
