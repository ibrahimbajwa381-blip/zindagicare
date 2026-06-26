import { buildPrivateMetadata } from "@/lib/seo/metadata";

export const metadata = buildPrivateMetadata("Offline");

export default function OfflineLayout({ children }: { children: React.ReactNode }) {
  return children;
}
