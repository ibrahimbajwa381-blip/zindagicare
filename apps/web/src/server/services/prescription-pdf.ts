import PDFDocument from "pdfkit";
import type { PrescriptionMedicationInput } from "@zindagi/validators";

export type PrescriptionPdfInput = {
  doctorName: string;
  pmdcNumber?: string;
  specialty: string;
  hospital?: string;
  patientName: string;
  patientPhone?: string;
  appointmentType: string;
  consultDate: Date;
  issuedAt: Date;
  medications: PrescriptionMedicationInput[];
  notes?: string;
};

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-PK", {
    timeZone: "Asia/Karachi",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateTime(date: Date): string {
  return date.toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export async function generatePrescriptionPdf(
  input: PrescriptionPdfInput,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    doc
      .fontSize(22)
      .fillColor("#0d9488")
      .text("ZindagiCare", { align: "center" });
    doc
      .fontSize(14)
      .fillColor("#334155")
      .text("Digital Prescription", { align: "center" });
    doc.moveDown(0.5);
    doc
      .strokeColor("#0d9488")
      .lineWidth(1)
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.margins.left + pageWidth, doc.y)
      .stroke();
    doc.moveDown(1);

    doc.fontSize(10).fillColor("#64748b").text(`Issued: ${formatDateTime(input.issuedAt)}`);
    doc.moveDown(0.75);

    doc.fontSize(11).fillColor("#0f172a").text("Prescribing Doctor", { underline: true });
    doc.moveDown(0.25);
    doc.fontSize(10).fillColor("#334155");
    doc.text(`Dr. ${input.doctorName}`);
    if (input.pmdcNumber) {
      doc.text(`PMDC Registration: ${input.pmdcNumber}`);
    }
    doc.text(`Specialty: ${input.specialty}`);
    if (input.hospital) {
      doc.text(`Hospital/Clinic: ${input.hospital}`);
    }
    doc.moveDown(0.75);

    doc.fontSize(11).fillColor("#0f172a").text("Patient", { underline: true });
    doc.moveDown(0.25);
    doc.fontSize(10).fillColor("#334155");
    doc.text(`Name: ${input.patientName}`);
    if (input.patientPhone) {
      doc.text(`Phone: ${input.patientPhone}`);
    }
    doc.text(`Consult type: ${input.appointmentType}`);
    doc.text(`Consult date: ${formatDate(input.consultDate)}`);
    doc.moveDown(1);

    doc.fontSize(11).fillColor("#0f172a").text("Medications", { underline: true });
    doc.moveDown(0.5);

    const colWidths = [pageWidth * 0.28, pageWidth * 0.18, pageWidth * 0.22, pageWidth * 0.22];
    const startX = doc.page.margins.left;
    let tableY = doc.y;

    const drawRow = (
      cells: string[],
      bold = false,
      fill?: string,
    ) => {
      const rowHeight = 22;
      if (tableY + rowHeight > doc.page.height - doc.page.margins.bottom - 80) {
        doc.addPage();
        tableY = doc.page.margins.top;
      }

      if (fill) {
        doc.rect(startX, tableY, pageWidth, rowHeight).fill(fill);
      }

      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9).fillColor("#334155");

      let x = startX + 4;
      cells.forEach((cell, i) => {
        doc.text(cell, x, tableY + 6, {
          width: colWidths[i]! - 8,
          lineBreak: false,
          ellipsis: true,
        });
        x += colWidths[i]!;
      });

      tableY += rowHeight;
      doc.y = tableY;
    };

    drawRow(["Medicine", "Dosage", "Frequency", "Duration"], true, "#f1f5f9");

    for (const med of input.medications) {
      drawRow([med.name, med.dosage, med.frequency, med.duration]);
    }

    doc.moveDown(1);

    if (input.notes?.trim()) {
      doc.fontSize(11).fillColor("#0f172a").text("Notes / Advice", { underline: true });
      doc.moveDown(0.25);
      doc.fontSize(10).fillColor("#334155").text(input.notes.trim(), {
        width: pageWidth,
      });
      doc.moveDown(1);
    }

    doc
      .fontSize(8)
      .fillColor("#64748b")
      .text(
        "This digital prescription was issued following a telemedicine consultation on ZindagiCare. " +
          "Prescriptions may be limited by law, drug schedule, or clinical judgment. " +
          "This is not a substitute for emergency care — call emergency services or visit the nearest hospital for urgent symptoms.",
        { width: pageWidth, align: "justify" },
      );

    doc.end();
  });
}
