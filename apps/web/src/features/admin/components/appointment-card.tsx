import { forwardRef } from "react";
import { CalendarClock, MapPin, Stethoscope, User } from "lucide-react";

export const APPT_CARD_WIDTH = 480;
export const APPT_CARD_HEIGHT = 600;

export type AppointmentCardProps = {
  patientName: string;
  doctorName: string;
  specialty?: string;
  type: string;
  dateLabel: string;
  timeLabel: string;
  location?: string;
  status: string;
};

export const AppointmentCard = forwardRef<HTMLDivElement, AppointmentCardProps>(
  function AppointmentCard(
    { patientName, doctorName, specialty, type, dateLabel, timeLabel, location, status },
    ref,
  ) {
    return (
      <div
        ref={ref}
        style={{
          width: APPT_CARD_WIDTH,
          height: APPT_CARD_HEIGHT,
          background: "linear-gradient(160deg, #082A66 0%, #0B3D91 32%, #0D8A80 68%, #0FA79B 100%)",
          fontFamily:
            "var(--font-display, 'Poppins'), var(--font-sans, 'Inter'), system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
          color: "#ffffff",
          boxSizing: "border-box",
          padding: "36px 32px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            alignSelf: "flex-start",
            borderRadius: 10,
            background: "rgba(255,255,255,0.92)",
            padding: "6px 12px",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo1.png" alt="ZindagiCare" style={{ height: 20, width: "auto", display: "block" }} />
        </div>

        <p style={{ marginTop: 28, fontSize: 22, fontWeight: 700 }}>Appointment Confirmed</p>
        <span
          style={{
            marginTop: 8,
            alignSelf: "flex-start",
            fontSize: 12,
            fontWeight: 600,
            padding: "4px 10px",
            borderRadius: 9999,
            background: "rgba(255,255,255,0.16)",
            border: "1px solid rgba(255,255,255,0.28)",
            textTransform: "capitalize",
          }}
        >
          {status}
        </span>

        <div
          style={{
            marginTop: 28,
            borderRadius: 18,
            background: "rgba(255,255,255,0.95)",
            color: "#0B3D91",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <Row icon={<User size={18} />} label="Patient" value={patientName} />
          <Row
            icon={<Stethoscope size={18} />}
            label="Doctor"
            value={specialty ? `${doctorName} (${specialty})` : doctorName}
          />
          <Row icon={<CalendarClock size={18} />} label="When" value={`${dateLabel} · ${timeLabel}`} />
          <Row
            icon={<MapPin size={18} />}
            label="Type"
            value={`${type.replace(/_/g, " ")}${location ? ` · ${location}` : ""}`}
          />
        </div>

        <div style={{ flex: 1 }} />

        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", textAlign: "center" }}>
          Please arrive / join a few minutes early. Questions? Contact ZindagiCare support.
        </p>
      </div>
    );
  },
);

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
      <div style={{ marginTop: 2, color: "#0D8A80" }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "#64748B", margin: 0, textTransform: "uppercase" }}>
          {label}
        </p>
        <p style={{ fontSize: 15, fontWeight: 600, margin: "2px 0 0", wordBreak: "break-word" }}>{value}</p>
      </div>
    </div>
  );
}
