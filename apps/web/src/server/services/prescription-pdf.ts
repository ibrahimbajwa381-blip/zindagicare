import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import type { PrescriptionMedicationInput } from "@zindagi/validators";

const require = createRequire(import.meta.url);

/** Intrinsic dimensions of public/logo1.png (full wordmark). */
const LOGO_WIDTH = 320;
const LOGO_HEIGHT = 120;
const LOGO_ASPECT = LOGO_WIDTH / LOGO_HEIGHT;

const BRAND = {
  header: "#062e2c",
  accent: "#0FA79B",
  accentNavy: "#0B3D91",
  text: "#334155",
  muted: "#64748b",
  heading: "#0f172a",
  tableHeader: "#f1f5f9",
} as const;

function getPDFDocument(): typeof import("pdfkit") {
  return require("pdfkit") as typeof import("pdfkit");
}

function resolvePublicAsset(filename: string): string | null {
  const candidates = [
    path.join(process.cwd(), "public", filename),
    path.join(process.cwd(), "apps", "web", "public", filename),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

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

function drawLetterhead(
  doc: InstanceType<ReturnType<typeof getPDFDocument>>,
  pageWidth: number,
): number {
  const logoPath = resolvePublicAsset("logo1.png");
  const logoDisplayWidth = Math.min(pageWidth * 0.78, 280);
  const logoDisplayHeight = logoDisplayWidth / LOGO_ASPECT;
  const headerPadTop = 24;
  const headerPadBottom = 20;
  const headerHeight = headerPadTop + logoDisplayHeight + headerPadBottom;

  doc.save();
  doc.rect(0, 0, doc.page.width, headerHeight).fill(BRAND.header);
  doc.rect(0, headerHeight - 3, doc.page.width, 3).fill(BRAND.accent);
  doc.restore();

  if (logoPath) {
    const logoX = doc.page.margins.left + (pageWidth - logoDisplayWidth) / 2;
    doc.image(logoPath, logoX, headerPadTop, {
      width: logoDisplayWidth,
      height: logoDisplayHeight,
    });
  } else {
    doc
      .font("Helvetica-Bold")
      .fontSize(24)
      .fillColor(BRAND.accent)
      .text("ZindagiCare", doc.page.margins.left, headerPadTop + 24, {
        width: pageWidth,
        align: "center",
      });
  }

  const contentTop = headerHeight + 22;

  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor(BRAND.accentNavy)
    .text("DIGITAL PRESCRIPTION", doc.page.margins.left, contentTop, {
      width: pageWidth,
      align: "center",
      characterSpacing: 1,
    });

  const ruleY = contentTop + 20;
  doc
    .strokeColor(BRAND.accent)
    .lineWidth(0.75)
    .moveTo(doc.page.margins.left + pageWidth * 0.12, ruleY)
    .lineTo(doc.page.margins.left + pageWidth * 0.88, ruleY)
    .stroke();

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(BRAND.muted)
    .text("Care. Innovation. Better Living.", doc.page.margins.left, ruleY + 8, {
      width: pageWidth,
      align: "center",
    });

  doc.y = ruleY + 28;
  return doc.y;
}

function drawFooter(
  doc: InstanceType<ReturnType<typeof getPDFDocument>>,
  pageWidth: number,
) {
  const iconPath = resolvePublicAsset("icon-192.png");
  const footerY = doc.page.height - doc.page.margins.bottom - 8;

  doc
    .strokeColor("#e2e8f0")
    .lineWidth(0.5)
    .moveTo(doc.page.margins.left, footerY - 14)
    .lineTo(doc.page.margins.left + pageWidth, footerY - 14)
    .stroke();

  if (iconPath) {
    doc.image(iconPath, doc.page.margins.left, footerY - 10, {
      width: 20,
      height: 20,
    });
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(BRAND.muted)
      .text(
        "ZindagiCare  ·  info.zindagicare@gmail.com  ·  Verified telemedicine — Lahore, Pakistan",
        doc.page.margins.left + 26,
        footerY - 4,
        { width: pageWidth - 26 },
      );
  } else {
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(BRAND.muted)
      .text("ZindagiCare  ·  info.zindagicare@gmail.com", doc.page.margins.left, footerY - 4, {
        width: pageWidth,
        align: "center",
      });
  }
}

export async function generatePrescriptionPdf(
  input: PrescriptionPdfInput,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const PDFDocument = getPDFDocument();
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    drawLetterhead(doc, pageWidth);

    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(BRAND.muted)
      .text(`Issued: ${formatDateTime(input.issuedAt)}`, { align: "right" });
    doc.moveDown(0.75);

    doc.fontSize(11).fillColor(BRAND.heading).text("Prescribing Doctor", { underline: true });
    doc.moveDown(0.25);
    doc.fontSize(10).fillColor(BRAND.text);
    doc.text(`Dr. ${input.doctorName}`);
    if (input.pmdcNumber) {
      doc.text(`PMDC Registration: ${input.pmdcNumber}`);
    }
    doc.text(`Specialty: ${input.specialty}`);
    if (input.hospital) {
      doc.text(`Hospital/Clinic: ${input.hospital}`);
    }
    doc.moveDown(0.75);

    doc.fontSize(11).fillColor(BRAND.heading).text("Patient", { underline: true });
    doc.moveDown(0.25);
    doc.fontSize(10).fillColor(BRAND.text);
    doc.text(`Name: ${input.patientName}`);
    if (input.patientPhone) {
      doc.text(`Phone: ${input.patientPhone}`);
    }
    doc.text(`Consult type: ${input.appointmentType}`);
    doc.text(`Consult date: ${formatDate(input.consultDate)}`);
    doc.moveDown(1);

    doc.fontSize(11).fillColor(BRAND.heading).text("Medications", { underline: true });
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

      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9).fillColor(BRAND.text);

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

    drawRow(["Medicine", "Dosage", "Frequency", "Duration"], true, BRAND.tableHeader);

    for (const med of input.medications) {
      drawRow([med.name, med.dosage, med.frequency, med.duration]);
    }

    doc.moveDown(1);

    if (input.notes?.trim()) {
      doc.fontSize(11).fillColor(BRAND.heading).text("Notes / Advice", { underline: true });
      doc.moveDown(0.25);
      doc.fontSize(10).fillColor(BRAND.text).text(input.notes.trim(), {
        width: pageWidth,
      });
      doc.moveDown(1);
    }

    doc
      .fontSize(8)
      .fillColor(BRAND.muted)
      .text(
        "This digital prescription was issued following a telemedicine consultation on ZindagiCare. " +
          "Prescriptions may be limited by law, drug schedule, or clinical judgment. " +
          "This is not a substitute for emergency care — call emergency services or visit the nearest hospital for urgent symptoms.",
        { width: pageWidth, align: "justify" },
      );

    drawFooter(doc, pageWidth);

    doc.end();
  });
}
