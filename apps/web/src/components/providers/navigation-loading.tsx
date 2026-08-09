"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";
import { workspaceShell } from "@/components/layout/workspace-content-nav-loading";

function isCrossShellNavigationClick(event: MouseEvent): boolean {
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
  if (next === current) return false;

  const fromShell = workspaceShell(window.location.pathname);
  const toShell = workspaceShell(url.pathname);
  // Same-shell navigations use the in-shell content loader instead.
  if (fromShell && fromShell === toShell) return false;

  return true;
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
      if (!isCrossShellNavigationClick(event)) return;
      setPending(true);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  if (!pending) return null;
  return <BrandLoadingScreen overlay />;
}

/** Full-page branded loader for cross-shell navigations until the next route commits. */
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
