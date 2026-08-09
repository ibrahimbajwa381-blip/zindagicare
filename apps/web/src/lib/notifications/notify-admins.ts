import { connectDatabase, UserModel } from "@zindagi/database";
import { Roles } from "@zindagi/shared";
import { safeDisplayText } from "@/server/lib/decrypt-pii";
import {
  getExtraAdminWhatsAppPhones,
  sendWhatsAppMessage,
} from "@/server/services/whatsapp.service";
import { deliverUserNotification } from "@/lib/notifications/deliver-notification";

/**
 * Notify every active admin / super_admin (in-app + WhatsApp) and any
 * WHATSAPP_ADMIN_PHONES ops numbers (WhatsApp only).
 */
export async function notifyAdmins(input: {
  title: string;
  body: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  await connectDatabase();

  const admins = await UserModel.find({
    roles: { $in: [Roles.ADMIN, Roles.SUPER_ADMIN] },
    isActive: { $ne: false },
    deletedAt: null,
  })
    .select("_id phone")
    .lean();

  const notifiedPhones = new Set<string>();

  await Promise.all(
    admins.map(async (admin) => {
      const phone = safeDisplayText(admin.phone);
      if (phone) notifiedPhones.add(phone);
      await deliverUserNotification({
        userId: admin._id.toString(),
        phone,
        title: input.title,
        body: input.body,
        payload: input.payload,
      });
    }),
  );

  const extras = getExtraAdminWhatsAppPhones();
  await Promise.all(
    extras.map(async (digits) => {
      // Avoid duplicate WhatsApp to the same number already covered via admin user.
      for (const phone of notifiedPhones) {
        const normalized = phone.replace(/\D/g, "");
        if (normalized === digits || normalized === `0${digits.slice(2)}`) {
          return;
        }
      }
      await sendWhatsAppMessage({
        to: digits,
        title: input.title,
        body: input.body,
      }).catch((err) => {
        console.error("[WhatsApp] admin extra phone failed", err);
      });
    }),
  );
}
