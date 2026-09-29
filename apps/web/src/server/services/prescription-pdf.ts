import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import type { PrescriptionMedicationInput } from "@zindagi/validators";
import { withDoctorTitle } from "@zindagi/shared";

const require = createRequire(import.meta.url);

/** Intrinsic dimensions of public/logo1.png (full wordmark). */
const LOGO_WIDTH = 320;
const LOGO_HEIGHT = 120;
const LOGO_ASPECT = LOGO_WIDTH / LOGO_HEIGHT;

const BRAND = {
  header: "#ffffff",
  headerBorder: "#e2e8f0",
  accent: "#0FA79B",
  accentNavy: "#0B3D91",
  text: "#334155",
  muted: "#64748b",
  heading: "#0f172a",
  tableHeader: "#f1f5f9",
  cardBorder: "#e2e8f0",
  cardFill: "#f8fafc",
} as const;

const CONTACT = {
  phone: "0327 7661515",
  website: "www.zindagicare.com",
  email: "info.zindagicare@gmail.com",
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
  doc
    .strokeColor(BRAND.headerBorder)
    .lineWidth(0.75)
    .moveTo(0, headerHeight - 3)
    .lineTo(doc.page.width, headerHeight - 3)
    .stroke();
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

function sectionHeading(
  doc: InstanceType<ReturnType<typeof getPDFDocument>>,
  pageWidth: number,
  label: string,
) {
  const barWidth = 3;
  const barHeight = 12;
  const y = doc.y + 1;
  doc.rect(doc.page.margins.left, y, barWidth, barHeight).fill(BRAND.accent);
  doc
    .font("Helvetica-Bold")
    .fontSize(10.5)
    .fillColor(BRAND.heading)
    .text(label.toUpperCase(), doc.page.margins.left + barWidth + 8, y - 1, {
      width: pageWidth - barWidth - 8,
      characterSpacing: 0.4,
    });
  doc.y = y + barHeight + 8;
}

function drawFooter(
  doc: InstanceType<ReturnType<typeof getPDFDocument>>,
  pageWidth: number,
) {
  const iconPath = resolvePublicAsset("icon-192.png");
  const lineY = doc.page.height - doc.page.margins.bottom - 34;
  const textY = lineY + 10;

  doc
    .strokeColor(BRAND.headerBorder)
    .lineWidth(0.75)
    .moveTo(doc.page.margins.left, lineY)
    .lineTo(doc.page.margins.left + pageWidth, lineY)
    .stroke();

  const textX = iconPath ? doc.page.margins.left + 26 : doc.page.margins.left;
  const textWidth = iconPath ? pageWidth - 26 : pageWidth;

  if (iconPath) {
    doc.image(iconPath, doc.page.margins.left, textY, { width: 20, height: 20 });
  }

  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(BRAND.accentNavy)
    .text("ZindagiCare", textX, textY, { continued: true, width: textWidth })
    .font("Helvetica")
    .fillColor(BRAND.muted)
    .text(`  ·  ${CONTACT.phone}  ·  ${CONTACT.website}  ·  ${CONTACT.email}`, {
      width: textWidth,
    });

  doc
    .font("Helvetica")
    .fontSize(7)
    .fillColor(BRAND.muted)
    .text("Verified telemedicine — Pakistan", textX, textY + 12, {
      width: textWidth,
    });
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

    const colGap = 14;
    const colW = (pageWidth - colGap) / 2;
    const cardPad = 10;
    const doctorLines = [
      withDoctorTitle(input.doctorName),
      ...(input.pmdcNumber ? [`PMDC Registration: ${input.pmdcNumber}`] : []),
      `Specialty: ${input.specialty}`,
      ...(input.hospital ? [`Hospital/Clinic: ${input.hospital}`] : []),
    ];
    const patientLines = [
      `Name: ${input.patientName}`,
      ...(input.patientPhone ? [`Phone: ${input.patientPhone}`] : []),
      `Consult type: ${input.appointmentType}`,
      `Consult date: ${formatDate(input.consultDate)}`,
    ];

    doc.font("Helvetica").fontSize(9.5);
    const doctorTextHeight = doc.heightOfString(doctorLines.join("\n"), {
      width: colW - cardPad * 2,
    });
    const patientTextHeight = doc.heightOfString(patientLines.join("\n"), {
      width: colW - cardPad * 2,
    });
    const cardTextHeight = Math.max(doctorTextHeight, patientTextHeight);
    const cardHeaderHeight = 22;
    const cardHeight = cardHeaderHeight + cardTextHeight + cardPad * 2;

    const cardTop = doc.y;
    const leftX = doc.page.margins.left;
    const rightX = leftX + colW + colGap;

    [
      { x: leftX, label: "Prescribing Doctor", lines: doctorLines },
      { x: rightX, label: "Patient", lines: patientLines },
    ].forEach(({ x, label, lines }) => {
      doc
        .roundedRect(x, cardTop, colW, cardHeight, 4)
        .fillAndStroke(BRAND.cardFill, BRAND.cardBorder);
      doc.rect(x, cardTop, 3, cardHeight).fill(BRAND.accent);
      doc
        .font("Helvetica-Bold")
        .fontSize(9.5)
        .fillColor(BRAND.accentNavy)
        .text(label.toUpperCase(), x + cardPad, cardTop + 9, {
          width: colW - cardPad * 2,
          characterSpacing: 0.3,
        });
      doc
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor(BRAND.text)
        .text(lines.join("\n"), x + cardPad, cardTop + cardHeaderHeight, {
          width: colW - cardPad * 2,
        });
    });

    doc.y = cardTop + cardHeight + 20;

    sectionHeading(doc, pageWidth, "Medications");

    const colWidths = [pageWidth * 0.28, pageWidth * 0.18, pageWidth * 0.22, pageWidth * 0.22];
    const startX = doc.page.margins.left;
    let tableY = doc.y;

    const drawRow = (
      cells: string[],
      bold = false,
      fill?: string,
    ) => {
      const rowHeight = 24;
      if (tableY + rowHeight > doc.page.height - doc.page.margins.bottom - 80) {
        doc.addPage();
        tableY = doc.page.margins.top;
      }

      doc.rect(startX, tableY, pageWidth, rowHeight).fillAndStroke(
        fill ?? "#ffffff",
        BRAND.cardBorder,
      );

      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9).fillColor(BRAND.text);

      let x = startX + 8;
      cells.forEach((cell, i) => {
        doc.text(cell, x, tableY + 7, {
          width: colWidths[i]! - 12,
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

    doc.moveDown(1.25);

    if (input.notes?.trim()) {
      sectionHeading(doc, pageWidth, "Notes / Advice");
      doc.fontSize(10).fillColor(BRAND.text).text(input.notes.trim(), {
        width: pageWidth,
      });
      doc.moveDown(1);
    }

    const disclaimerText =
      "This digital prescription was issued following a telemedicine consultation on ZindagiCare. " +
      "Prescriptions may be limited by law, drug schedule, or clinical judgment. " +
      "This is not a substitute for emergency care — call emergency services or visit the nearest hospital for urgent symptoms.";

    const disclaimerPadding = 10;
    doc.font("Helvetica").fontSize(8);
    const disclaimerTextHeight = doc.heightOfString(disclaimerText, {
      width: pageWidth - disclaimerPadding * 2,
    });
    const disclaimerBoxHeight = disclaimerTextHeight + disclaimerPadding * 2;
    const footerReserve = 60;

    if (
      doc.y + disclaimerBoxHeight >
      doc.page.height - doc.page.margins.bottom - footerReserve
    ) {
      doc.addPage();
      doc.y = doc.page.margins.top;
    }

    const disclaimerX = doc.page.margins.left;
    const disclaimerY = doc.y;
    doc
      .roundedRect(disclaimerX, disclaimerY, pageWidth, disclaimerBoxHeight, 4)
      .fillAndStroke(BRAND.cardFill, BRAND.cardBorder);
    doc
      .fillColor(BRAND.muted)
      .text(disclaimerText, disclaimerX + disclaimerPadding, disclaimerY + disclaimerPadding, {
        width: pageWidth - disclaimerPadding * 2,
      });
    doc.y = disclaimerY + disclaimerBoxHeight;

    drawFooter(doc, pageWidth);

    doc.end();
  });
}
