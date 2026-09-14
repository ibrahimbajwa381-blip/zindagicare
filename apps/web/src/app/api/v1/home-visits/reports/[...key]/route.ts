import { unwrapEncryptedFile } from "@zindagi/shared/crypto/field-encryption";
import path from "path";
import { resolveSession } from "@/server/api/resolve-session";
import { connectDatabase, HomeVisitModel } from "@zindagi/database";
import { AppError, isAdmin } from "@zindagi/shared";
import { validateStorageKey } from "@/server/lib/object-storage";
import { readHomeVisitReport } from "@/server/services/home-visit-reports.storage";

type Params = { params: Promise<{ key: string[] }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const session = await resolveSession(req);
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { key: keyParts } = await params;
    const storageKey = decodeURIComponent(keyParts.join("/"));
    validateStorageKey(storageKey);

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

    const raw = await readHomeVisitReport(storageKey);
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
