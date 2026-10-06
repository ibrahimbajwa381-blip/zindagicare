import { renderDoctorOgImage } from "@/features/marketing/og/doctor-og-image";

export const alt = "Doctor profile on ZindagiCare";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return renderDoctorOgImage(slug);
}
