"use client";

import { useEffect, useRef } from "react";

type Props = {
  actionUrl: string;
  fields: Record<string, string>;
};

export function JazzCashRedirectForm({ actionUrl, fields }: Props) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.submit();
  }, [actionUrl, fields]);

  return (
    <form ref={formRef} method="POST" action={actionUrl} className="hidden">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </form>
  );
}
