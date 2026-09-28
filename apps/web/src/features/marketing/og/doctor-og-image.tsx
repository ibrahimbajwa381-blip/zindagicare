import { ImageResponse } from "next/og";
import { siteConfig } from "@/config/site";
import { formatQualificationsList } from "@/lib/doctors/qualifications";
import { formatDoctorDisplayName } from "@/lib/doctors/profile-path";
import { getSiteUrl } from "@/lib/seo/metadata";
import { PublicDoctorService } from "@/server/services/public-doctor.service";

export const DOCTOR_OG_SIZE = { width: 1200, height: 630 };

const BRAND = "#0fa79b";
const BRAND_DARK = "#0d8a80";
const AVATAR_TIMEOUT_MS = 3000;
const AVATAR_MAX_BYTES = 2_000_000;

/**
 * Satori (the ImageResponse renderer) only decodes PNG/JPEG/GIF, so the avatar is fetched
 * and inlined as a data URL when it's one of those; anything else (e.g. WebP) falls back to
 * initials instead of breaking the whole image.
 */
async function loadAvatarDataUrl(avatarUrl?: string): Promise<string | null> {
  if (!avatarUrl) return null;
  try {
    const absolute = avatarUrl.startsWith("http") ? avatarUrl : getSiteUrl(avatarUrl);
    const res = await fetch(absolute, { signal: AbortSignal.timeout(AVATAR_TIMEOUT_MS) });
    if (!res.ok) return null;
    const type = res.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (type !== "image/png" && type !== "image/jpeg" && type !== "image/gif") return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > AVATAR_MAX_BYTES) return null;
    return `data:${type};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

function initials(name: string) {
  return name
    .replace(/^(dr|prof|professor)\.?\s+/i, "")
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Branded 1200×630 social preview for /doctors/[slug] (WhatsApp, Facebook, LinkedIn, X). */
export async function renderDoctorOgImage(slug: string) {
  const doctor = await PublicDoctorService.getPublicDoctor(slug).catch(() => null);

  if (!doctor) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: BRAND,
            color: "white",
            fontSize: 64,
            fontWeight: 700,
          }}
        >
          {siteConfig.name}
        </div>
      ),
      DOCTOR_OG_SIZE,
    );
  }

  const name = formatDoctorDisplayName(doctor.name);
  const avatar = await loadAvatarDataUrl(doctor.avatarUrl);
  const credentials = formatQualificationsList(doctor.medicalDegree, doctor.qualifications).join(", ");
  const specialty = doctor.specialties.join(" · ") || "Doctor";
  const tagline = doctor.portfolio.headline ?? doctor.hospitals[0]?.name;
  const facts = [
    doctor.experienceYears > 0 ? `${doctor.experienceYears}+ years experience` : null,
    doctor.ratingCount > 0 ? `Rated ${doctor.ratingAvg.toFixed(1)}/5 (${doctor.ratingCount} reviews)` : null,
    doctor.pmdcVerified ? "PMDC verified" : null,
  ].filter((f): f is string => Boolean(f));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #f0fdfa 0%, #ffffff 55%, #ecfeff 100%)",
          padding: 64,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 56 }}>
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt=""
              width={300}
              height={300}
              style={{ borderRadius: 48, objectFit: "cover", border: "8px solid white" }}
            />
          ) : (
            <div
              style={{
                width: 300,
                height: 300,
                borderRadius: 48,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: BRAND,
                color: "white",
                fontSize: 120,
                fontWeight: 700,
              }}
            >
              {initials(doctor.name)}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", fontSize: 60, fontWeight: 700, color: "#0f172a", lineHeight: 1.1 }}>
              {truncate(name, 32)}
            </div>
            {credentials && (
              <div style={{ display: "flex", marginTop: 12, fontSize: 28, color: "#475569" }}>
                {truncate(credentials, 60)}
              </div>
            )}
            <div style={{ display: "flex", marginTop: 16, fontSize: 36, fontWeight: 600, color: BRAND_DARK }}>
              {truncate(specialty, 44)}
            </div>
            {tagline && (
              <div style={{ display: "flex", marginTop: 20, fontSize: 30, color: "#334155", lineHeight: 1.3 }}>
                {truncate(tagline, 90)}
              </div>
            )}
            {facts.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 28 }}>
                {facts.map((fact) => (
                  <div
                    key={fact}
                    style={{
                      display: "flex",
                      padding: "8px 20px",
                      borderRadius: 999,
                      background: "white",
                      border: "2px solid #ccfbf1",
                      fontSize: 24,
                      color: "#0f172a",
                    }}
                  >
                    {fact}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "2px solid #e2e8f0",
            paddingTop: 24,
            fontSize: 26,
            color: "#475569",
          }}
        >
          <div style={{ display: "flex", fontWeight: 700, color: BRAND }}>{siteConfig.name}</div>
          <div style={{ display: "flex" }}>
            {doctor.consultationFee > 0
              ? `Book online · Rs. ${doctor.consultationFee.toLocaleString("en-PK")}`
              : "Book an online consultation"}
          </div>
        </div>
      </div>
    ),
    DOCTOR_OG_SIZE,
  );
}
