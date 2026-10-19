"use client";

import { useMemo } from "react";
import { createConsultProviderApi } from "./api";
import { getConsultProviderAdminConfig, type ConsultProviderKind } from "./config";

/** Resolve the config + API client for a provider kind (stable per kind). */
export function useConsultProviderAdmin(kind: ConsultProviderKind) {
  return useMemo(() => {
    const config = getConsultProviderAdminConfig(kind);
    return { config, api: createConsultProviderApi(config) };
  }, [kind]);
}
