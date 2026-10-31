import { z } from "zod";

export const PLANNING_KINDS = [
  "plan",
  "target",
  "partnership",
  "achievement",
  "campaign",
  "challenge",
  "expense",
] as const;
export const PLANNING_STATUSES = ["planned", "in_progress", "on_hold", "done", "cancelled"] as const;
export const PLANNING_PRIORITIES = ["low", "medium", "high"] as const;
export const PARTNER_TYPES = [
  "hospital",
  "clinic",
  "lab",
  "pharmacy",
  "university",
  "ngo",
  "corporate",
  "other",
] as const;
export const PARTNER_STAGES = [
  "prospect",
  "contacted",
  "negotiating",
  "signed",
  "active",
  "ended",
] as const;

const optionalText = (max: number) => z.string().trim().max(max).optional();
const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date")
  .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date")
  .optional();
const optionalAmount = z.number().min(0).max(1_000_000_000).optional();

/**
 * Admin Planning board entry. Used for create and for edit — an edit sends the
 * whole entry, and any optional field left out is cleared.
 */
export const planningItemSchema = z
  .object({
    kind: z.enum(PLANNING_KINDS),
    title: z.string().trim().min(2, "Give it a title").max(200),
    description: optionalText(4000),
    city: optionalText(80),
    status: z.enum(PLANNING_STATUSES).default("planned"),
    priority: z.enum(PLANNING_PRIORITIES).default("medium"),
    owner: optionalText(120),
    startDate: optionalDate,
    dueDate: optionalDate,
    month: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use a YYYY-MM month")
      .optional(),
    metric: optionalText(120),
    unit: optionalText(40),
    targetValue: optionalAmount,
    currentValue: optionalAmount,
    partnerType: z.enum(PARTNER_TYPES).optional(),
    stage: z.enum(PARTNER_STAGES).optional(),
    contactName: optionalText(120),
    contactPhone: optionalText(40),
    achievedAt: optionalDate,
    budget: optionalAmount,
  })
  .superRefine((item, ctx) => {
    if (item.kind === "target") {
      if (!item.month) ctx.addIssue({ code: "custom", path: ["month"], message: "Pick the month" });
      if (!item.targetValue) {
        ctx.addIssue({ code: "custom", path: ["targetValue"], message: "Set a target number" });
      }
    }
    if (item.kind === "expense" && !item.budget) {
      ctx.addIssue({ code: "custom", path: ["budget"], message: "Set the monthly amount" });
    }
    if (item.startDate && item.dueDate && item.dueDate < item.startDate) {
      ctx.addIssue({ code: "custom", path: ["dueDate"], message: "Due date is before the start" });
    }
  });

export type PlanningItemInput = z.infer<typeof planningItemSchema>;

/** Which month the board's live platform numbers are for. */
export const planningBoardQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use a YYYY-MM month")
    .optional(),
});
