import { z } from "zod";

export const sendChatMessageSchema = z
  .object({
    body: z.string().trim().max(5000).optional().default(""),
    locale: z.enum(["en", "ur"]).optional(),
    attachmentUrl: z.string().trim().min(1).max(500).optional(),
    attachmentMime: z.string().trim().min(1).max(100).optional(),
  })
  .refine((v) => v.body.length > 0 || !!v.attachmentUrl, {
    message: "Message cannot be empty",
    path: ["body"],
  });

export const createDirectThreadSchema = z.object({
  participantId: z.string().min(1),
});

export const listChatMessagesQuerySchema = z.object({
  before: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const listChatContactsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
});

export type SendChatMessageInput = z.infer<typeof sendChatMessageSchema>;
export type CreateDirectThreadInput = z.infer<typeof createDirectThreadSchema>;
export type ListChatMessagesQuery = z.infer<typeof listChatMessagesQuerySchema>;
export type ListChatContactsQuery = z.infer<typeof listChatContactsQuerySchema>;
