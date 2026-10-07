import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";

export default function MarketingLoading() {
  return (
    <>
      {/*
        The overlay is `fixed`, so without this spacer the footer sits right under
        the header behind it. When streamed page content replaces this fallback,
        the footer jumps thousands of px and counts as a huge layout shift (CLS).
      */}
      <div aria-hidden className="min-h-dvh" />
      <BrandLoadingScreen overlay />
    </>
  );
}
