import { permanentRedirect } from "next/navigation";
import { siteConfig } from "@/config/site";

/** Home physiotherapy now lives on the physiotherapist directory, where patients pick a provider. */
export default function HomePhysiotherapyPage() {
  permanentRedirect(siteConfig.links.physiotherapists);
}
