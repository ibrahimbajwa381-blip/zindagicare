"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { cn } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

type Props = {
  className?: string;
};

export function ShareReviewLink({ className }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = `${siteConfig.url}${siteConfig.links.shareReview}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "Share your ZindagiCare experience", url });
      } catch {
        // user cancelled share sheet — no action needed
      }
      return;
    }

    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleShare}
      className={cn("gap-1.5", className)}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
      {copied ? "Link copied" : "Share & get reviewed"}
    </Button>
  );
}
