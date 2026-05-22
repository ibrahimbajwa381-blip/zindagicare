import { Schema } from "mongoose";

/** Reusable GeoJSON Point for 2dsphere indexes (home visits, hospitals). */
export const geoPointSchema = new Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (v: number[]) =>
          v.length === 2 &&
          v[0] >= -180 &&
          v[0] <= 180 &&
          v[1] >= -90 &&
          v[1] <= 90,
        message: "coordinates must be [lng, lat]",
      },
    },
  },
  { _id: false },
);
