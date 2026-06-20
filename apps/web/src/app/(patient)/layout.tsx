import dynamic from "next/dynamic";

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
