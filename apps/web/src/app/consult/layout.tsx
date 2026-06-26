import { buildPrivateMetadata } from "@/lib/seo/metadata";

export const metadata = buildPrivateMetadata();

export default function ConsultLayout({ children }: { children: React.ReactNode }) {
  return children;
}
