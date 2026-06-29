"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";

function isInternalNavigationClick(event: MouseEvent): boolean {
  if (event.defaultPrevented) return false;
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;

  const target = event.target;
  if (!(target instanceof Element)) return false;

  const anchor = target.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return false;
  if (anchor.target === "_blank" || anchor.hasAttribute("download")) return false;

  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return false;
  }

  let url: URL;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return false;
  }

  if (url.origin !== window.location.origin) return false;

  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  return next !== current;
}

function NavigationLoadingInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const routeKeyRef = useRef(routeKey);

  useEffect(() => {
    routeKeyRef.current = routeKey;

    let frame = 0;
    const raf = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        if (routeKeyRef.current === routeKey) {
          setPending(false);
        }
      });
    });

    return () => cancelAnimationFrame(raf);
  }, [routeKey]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!isInternalNavigationClick(event)) return;
      setPending(true);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  if (!pending) return null;
  return <BrandLoadingScreen overlay />;
}

/** Shows the branded loader immediately on in-app link clicks until the next route commits. */
export function NavigationLoadingProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Suspense fallback={null}>
        <NavigationLoadingInner />
      </Suspense>
    </>
  );
}
