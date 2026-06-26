import type { Metadata } from "next";
import { buildPrivateMetadata } from "@/lib/seo/metadata";

export const transactionalMetadata: Metadata = buildPrivateMetadata();
