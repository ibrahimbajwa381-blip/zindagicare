import { z } from "zod";

export const pushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  expirationTime: z.number().nullable().optional(),
});

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

export const expoPushRegisterSchema = z.object({
  token: z.string().min(1),
  deviceId: z.string().min(1).optional(),
  platform: z.enum(["ios", "android"]).optional(),
});

export const expoPushUnregisterSchema = z.object({
  token: z.string().min(1),
});

export type PushSubscribeInput = z.infer<typeof pushSubscribeSchema>;
export type PushUnsubscribeInput = z.infer<typeof pushUnsubscribeSchema>;
export type ExpoPushRegisterInput = z.infer<typeof expoPushRegisterSchema>;
export type ExpoPushUnregisterInput = z.infer<typeof expoPushUnregisterSchema>;
