import { z } from "zod";

/** Patient submits a rating after a completed consultation. */
export const submitReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
});

export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;
