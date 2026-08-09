"use client";

import { usePathname, useSearchParams } from "next/navigation";
import {
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";

export type WorkspaceShellId =
  | "admin"
  | "doctor"
  | "nurse"
  | "physiotherapist"
  | "patient";

export function workspaceShell(pathname: string): WorkspaceShellId | null {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  if (pathname === "/doctor" || pathname.startsWith("/doctor/")) return "doctor";
  if (pathname === "/nurse" || pathname.startsWith("/nurse/")) return "nurse";
  if (
    pathname === "/physiotherapist" ||
    pathname.startsWith("/physiotherapist/")
  ) {
    return "physiotherapist";
  }
  if (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/messages" ||
    pathname.startsWith("/messages/") ||
    pathname === "/family" ||
    pathname.startsWith("/family/") ||
    pathname === "/records" ||
    pathname.startsWith("/records/") ||
    pathname === "/settings" ||
    pathname.startsWith("/settings/")
  ) {
    return "patient";
  }
  return null;
}

function isSameShellNavigationClick(
  event: MouseEvent,
  shell: WorkspaceShellId,
): boolean {
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

  const next = `${url.pathname}${url.search}`;
  const current = `${window.location.pathname}${window.location.search}`;
  if (next === current) return false;

  return (
    workspaceShell(window.location.pathname) === shell &&
    workspaceShell(url.pathname) === shell
  );
}

function useSameShellNavPending(shell: WorkspaceShellId) {
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
      if (!isSameShellNavigationClick(event, shell)) return;
      setPending(true);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [shell]);

  return pending;
}

function WorkspaceContentNavLoadingInner({
  shell,
  children,
}: {
  shell: WorkspaceShellId;
  children: ReactNode;
}) {
  const pending = useSameShellNavPending(shell);

  if (pending) {
    return <BrandLoadingScreen message="Loading…" />;
  }

  return children;
}

/**
 * Immediate content-area loader for soft navigations inside a workspace shell.
 * Sidebar/header stay mounted; only the page body shows the branded loader.
 */
export function WorkspaceContentNavLoading({
  shell,
  children,
}: {
  shell: WorkspaceShellId;
  children: ReactNode;
}) {
  return (
    <Suspense fallback={children}>
      <WorkspaceContentNavLoadingInner shell={shell}>
        {children}
      </WorkspaceContentNavLoadingInner>
    </Suspense>
  );
}
