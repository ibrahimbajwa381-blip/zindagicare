/**
 * Standalone (no heavy deps) so it's safe to import from Edge middleware, which can't
 * bundle Node-only modules like mongoose/crypto pulled in by doctor-referral.service.ts.
 */
export const REFERRAL_COOKIE_NAME = "zc_ref";
