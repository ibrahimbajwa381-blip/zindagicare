import dynamic from "next/dynamic";
import { buildPrivateMetadata } from "@/lib/seo/metadata";

export const metadata = buildPrivateMetadata();

const PatientShell = dynamic(() =>
  import("./patient-shell").then((mod) => ({ default: mod.PatientShell })),
);

export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PatientShell>{children}</PatientShell>;
}
