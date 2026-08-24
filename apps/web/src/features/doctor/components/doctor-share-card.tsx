import { forwardRef } from "react";
import { BadgeCheck, Building2, Star } from "lucide-react";

export const SHARE_CARD_WIDTH = 540;
export const SHARE_CARD_HEIGHT = 960;

export type DoctorShareCardProps = {
  name: string;
  avatarUrl?: string | null;
  specialty: string;
  qualifications?: string[];
  hospital?: string;
  city?: string;
  experienceYears?: number;
  ratingAvg?: number;
  ratingCount?: number;
  consultationFee?: number;
  pmdcVerified?: boolean;
  profileUrl: string;
  qrDataUrl?: string | null;
};

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Fixed-size (540x960) poster used both for on-screen preview and as the
 * capture target for html-to-image — keep it free of relative/viewport units
 * so the rasterized PNG always matches the on-screen design.
 */
export const DoctorShareCard = forwardRef<HTMLDivElement, DoctorShareCardProps>(
  function DoctorShareCard(
    {
      name,
      avatarUrl,
      specialty,
      qualifications = [],
      hospital,
      city,
      experienceYears,
      ratingAvg,
      ratingCount,
      consultationFee,
      pmdcVerified,
      profileUrl,
      qrDataUrl,
    },
    ref,
  ) {
    const shortUrl = profileUrl.replace(/^https?:\/\//, "");

    return (
      <div
        ref={ref}
        style={{
          width: SHARE_CARD_WIDTH,
          height: SHARE_CARD_HEIGHT,
          background:
            "linear-gradient(160deg, #082A66 0%, #0B3D91 32%, #0D8A80 68%, #0FA79B 100%)",
          fontFamily:
            "var(--font-display, 'Poppins'), var(--font-sans, 'Inter'), system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
          color: "#ffffff",
        }}
      >
        {/* decorative background blobs */}
        <div
          style={{
            position: "absolute",
            top: -80,
            right: -80,
            width: 260,
            height: 260,
            borderRadius: "9999px",
            background: "rgba(255,255,255,0.08)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -60,
            left: -60,
            width: 200,
            height: 200,
            borderRadius: "9999px",
            background: "rgba(255,255,255,0.06)",
          }}
        />

        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            height: "100%",
            padding: "40px 36px 32px",
            boxSizing: "border-box",
          }}
        >
          {/* wordmark */}
          <div
            style={{
              alignSelf: "flex-start",
              borderRadius: 10,
              background: "rgba(255,255,255,0.92)",
              padding: "6px 12px",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo1.png"
              alt="ZindagiCare"
              style={{ height: 22, width: "auto", display: "block" }}
            />
          </div>

          {/* avatar */}
          <div
            style={{
              marginTop: 36,
              width: 176,
              height: 176,
              borderRadius: "9999px",
              padding: 6,
              background: "rgba(255,255,255,0.9)",
              boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
            }}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={name}
                crossOrigin="anonymous"
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "9999px",
                  objectFit: "cover",
                  objectPosition: "top",
                  display: "block",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "9999px",
                  background: "#ffffff",
                  color: "#0B3D91",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 52,
                  fontWeight: 700,
                }}
              >
                {initialsOf(name)}
              </div>
            )}
          </div>

          {/* name + verified */}
          <div
            style={{
              marginTop: 22,
              display: "flex",
              alignItems: "center",
              gap: 8,
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: 27, fontWeight: 700, lineHeight: 1.2 }}>
              {name}
            </span>
            {pmdcVerified && <BadgeCheck size={22} color="#5FD4C8" />}
          </div>

          <p
            style={{
              marginTop: 6,
              fontSize: 16,
              color: "rgba(255,255,255,0.85)",
              textAlign: "center",
            }}
          >
            {specialty}
          </p>

          {qualifications.length > 0 && (
            <div
              style={{
                marginTop: 12,
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: 6,
              }}
            >
              {qualifications.slice(0, 3).map((q) => (
                <span
                  key={q}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "4px 10px",
                    borderRadius: 9999,
                    background: "rgba(255,255,255,0.14)",
                    border: "1px solid rgba(255,255,255,0.25)",
                  }}
                >
                  {q}
                </span>
              ))}
            </div>
          )}

          {hospital && (
            <div
              style={{
                marginTop: 16,
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 14,
                color: "rgba(255,255,255,0.9)",
                textAlign: "center",
              }}
            >
              <Building2 size={16} />
              <span>
                {hospital}
                {city ? `, ${city}` : ""}
              </span>
            </div>
          )}

          {/* stats row */}
          <div
            style={{
              marginTop: 28,
              width: "100%",
              display: "flex",
              borderRadius: 18,
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.2)",
              overflow: "hidden",
            }}
          >
            {typeof ratingAvg === "number" && ratingCount ? (
              <div
                style={{
                  flex: 1,
                  padding: "14px 8px",
                  textAlign: "center",
                  borderRight: "1px solid rgba(255,255,255,0.18)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    fontSize: 18,
                    fontWeight: 700,
                  }}
                >
                  <Star size={15} color="#FBBF24" fill="#FBBF24" />
                  {ratingAvg.toFixed(1)}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>
                  {ratingCount} reviews
                </div>
              </div>
            ) : null}

            {typeof experienceYears === "number" && experienceYears > 0 && (
              <div
                style={{
                  flex: 1,
                  padding: "14px 8px",
                  textAlign: "center",
                  borderRight: "1px solid rgba(255,255,255,0.18)",
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 700 }}>{experienceYears}+</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>
                  yrs experience
                </div>
              </div>
            )}

            {typeof consultationFee === "number" && (
              <div style={{ flex: 1, padding: "14px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>
                  Rs. {consultationFee.toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>
                  per consultation
                </div>
              </div>
            )}
          </div>

          <div style={{ flex: 1 }} />

          {/* footer: QR + link */}
          <div
            style={{
              width: "100%",
              borderRadius: 20,
              background: "rgba(255,255,255,0.95)",
              color: "#0B3D91",
              padding: "16px 18px",
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt="Scan to view profile"
                style={{ width: 64, height: 64, borderRadius: 8, flexShrink: 0 }}
              />
            ) : null}
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>
                Book an appointment with me
              </p>
              <p
                style={{
                  fontSize: 12,
                  color: "#0D8A80",
                  margin: "3px 0 0",
                  wordBreak: "break-all",
                  fontWeight: 600,
                }}
              >
                {shortUrl}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  },
);
