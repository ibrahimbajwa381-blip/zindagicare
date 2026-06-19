import { generatePrescriptionPdf } from "../src/server/services/prescription-pdf";

async function main() {
  const buffer = await generatePrescriptionPdf({
    doctorName: "Ayesha Khan",
    pmdcNumber: "12345-P",
    specialty: "General Physician",
    hospital: "Services Hospital Lahore",
    patientName: "Test Patient",
    patientPhone: "0300 1234567",
    appointmentType: "Online Consultation",
    consultDate: new Date("2026-06-18T10:00:00+05:00"),
    issuedAt: new Date(),
    medications: [
      {
        name: "Paracetamol",
        dosage: "500mg",
        frequency: "Twice daily",
        duration: "5 days",
      },
    ],
    notes: "Rest and plenty of fluids.",
  });

  if (!Buffer.isBuffer(buffer) || buffer.length < 500) {
    console.error("FAIL: PDF buffer too small or invalid");
    process.exit(1);
  }

  const header = buffer.subarray(0, 5).toString("utf8");
  if (!header.startsWith("%PDF")) {
    console.error("FAIL: Output is not a valid PDF");
    process.exit(1);
  }

  console.log(`OK: Generated prescription PDF (${buffer.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
