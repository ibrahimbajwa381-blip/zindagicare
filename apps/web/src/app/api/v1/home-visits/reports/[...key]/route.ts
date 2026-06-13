import { unwrapEncryptedFile } from "@zindagi/shared/crypto/field-encryption";
import { readFile } from "fs/promises";
import path from "path";
import { auth } from "@/lib/auth";
import { connectDatabase, HomeVisitModel } from "@zindagi/database";
import { AppError, isAdmin } from "@zindagi/shared";
import { resolveHomeVisitReportPath } from "@/server/services/home-visit-reports.storage";

type Params = { params: Promise<{ key: string[] }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { key: keyParts } = await params;
    const storageKey = decodeURIComponent(keyParts.join("/"));

    await connectDatabase();
    const visit = await HomeVisitModel.findOne({
      "visitReport.storageKey": storageKey,
      deletedAt: { $exists: false },
    }).lean();

    if (!visit) {
      return new Response("Not found", { status: 404 });
    }

    const userId = session.user.id;
    const roles = session.user.roles ?? [];
    const isPatient = visit.patientId?.toString() === userId;
    const isStaff = visit.assignedStaffId?.toString() === userId;
    const admin = isAdmin(roles as never);

    if (!isPatient && !isStaff && !admin) {
      return new Response("Forbidden", { status: 403 });
    }

    const absolutePath = resolveHomeVisitReportPath(storageKey);
    const raw = await readFile(absolutePath);
    const buffer = unwrapEncryptedFile(raw);
    const mimeType =
      visit.visitReport?.mimeType ?? "application/octet-stream";
    const filename = visit.visitReport?.originalName ?? path.basename(storageKey);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (e) {
    if (e instanceof AppError) {
      return new Response(e.message, { status: e.statusCode });
    }
    return new Response("Not found", { status: 404 });
  }
}
