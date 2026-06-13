import { z } from "zod";

export const geoPointInputSchema = z.object({
  lng: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
});

export type GeoPointInput = z.infer<typeof geoPointInputSchema>;
