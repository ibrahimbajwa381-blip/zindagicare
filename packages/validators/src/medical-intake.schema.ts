import { z } from "zod";

/** Patient submits the intake form (Sunday free consults). */
export const submitIntakeFormSchema = z.object({
  answers: z
    .array(
      z.object({
        key: z.string().min(1).max(100),
        answer: z.string().trim().max(2000),
      }),
    )
    .min(1)
    .max(20),
});

/** Doctor saves their custom question list. */
export const updateIntakeQuestionsSchema = z.object({
  questions: z
    .array(
      z.object({
        id: z.string().min(1).max(100),
        text: z.string().trim().min(5).max(300),
        order: z.number().int().min(0),
        isActive: z.boolean(),
      }),
    )
    .max(20),
});

export type SubmitIntakeFormInput = z.infer<typeof submitIntakeFormSchema>;
export type UpdateIntakeQuestionsInput = z.infer<
  typeof updateIntakeQuestionsSchema
>;
