import { buildPrivateMetadata } from "@/lib/seo/metadata";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { VideoConsultClient } from "@/features/consult/components/video-consult-client";

export const metadata = buildPrivateMetadata("Video consultation");

type PageProps = {
  params: Promise<{ appointmentId: string }>;
  searchParams: Promise<{ left?: string }>;
};

export default async function VideoConsultPage({ params, searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) {
    const { appointmentId } = await params;
    redirect(`/login?callbackUrl=/consult/video/${appointmentId}`);
  }

  const { appointmentId } = await params;
  const { left } = await searchParams;

  return (
    <main className="min-h-screen">
      <VideoConsultClient appointmentId={appointmentId} leftSession={left === "1"} />
    </main>
  );
}
