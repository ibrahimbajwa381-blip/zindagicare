import { z } from "zod";
import { withApiHandler } from "@/server/api/with-api-handler";
import { PublicPhysiotherapistService } from "@/server/services/public-physiotherapist.service";

const querySchema = z.object({
  city: z.string().trim().max(60).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  nearby: z.enum(["1", "true"]).optional(),
});

/** Public directory: verified physiotherapists, nearest-first when lat/lng are given. */
export const GET = withApiHandler(
  async ({ searchParams }) => {
    const query = querySchema.parse({
      city: searchParams.get("city") ?? undefined,
      lat: searchParams.get("lat") ?? undefined,
      lng: searchParams.get("lng") ?? undefined,
      nearby: searchParams.get("nearby") ?? undefined,
    });
    const near =
      query.lat !== undefined && query.lng !== undefined
        ? { lat: query.lat, lng: query.lng }
        : undefined;
    return PublicPhysiotherapistService.list({
      city: query.city,
      near,
      nearbyOnly: Boolean(near && query.nearby),
    });
  },
  { public: true },
);
