"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { surfaceCard } from "@/lib/ui/surfaces";

const PRESETS = [
  {
    title: "Sunday consult is open",
    body: "Free 10-minute Sunday consultations are now open. Book your slot on ZindagiCare.",
  },
  {
    title: "System maintenance",
    body: "ZindagiCare will undergo brief maintenance tonight 12–2 AM. Some services may be unavailable.",
  },
];

export function AdminNotificationsPanel() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState<"in_app" | "sms" | "email">("in_app");
  const [audience, setAudience] = useState<"all" | "patients" | "doctors" | "user">("all");
  const [userEmail, setUserEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setResult(null);

    const res = await fetch("/api/v1/admin/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        body,
        channel,
        audience,
        userEmail: audience === "user" ? userEmail : undefined,
      }),
    });

    const json = await res.json();
    setPending(false);

    if (json.success) {
      setResult(
        `Sent to ${json.data.sent} of ${json.data.recipientCount} recipients (${channel}).`,
      );
      setTitle("");
      setBody("");
    } else {
      setResult(json?.error?.message ?? "Send failed");
    }
  };

  return (
    <div className="space-y-6">
      <Card className={surfaceCard}>
        <CardHeader>
          <CardTitle className="text-base">Quick presets</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.title}
              size="sm"
              variant="outline"
              type="button"
              onClick={() => {
                setTitle(p.title);
                setBody(p.body);
              }}
            >
              {p.title}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card className={surfaceCard}>
        <CardHeader>
          <CardTitle className="text-base">Send notification</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={send} className="space-y-4">
            <Input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <textarea
              className="min-h-[100px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Message body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                Channel
                <select
                  className="mt-1 w-full rounded-lg border px-2 py-2 text-sm"
                  value={channel}
                  onChange={(e) =>
                    setChannel(e.target.value as "in_app" | "sms" | "email")
                  }
                >
                  <option value="in_app">In-app</option>
                  <option value="sms">SMS (stub)</option>
                  <option value="email">Email (stub)</option>
                </select>
              </label>
              <label className="text-sm">
                Audience
                <select
                  className="mt-1 w-full rounded-lg border px-2 py-2 text-sm"
                  value={audience}
                  onChange={(e) =>
                    setAudience(e.target.value as typeof audience)
                  }
                >
                  <option value="all">All users</option>
                  <option value="patients">All patients</option>
                  <option value="doctors">All doctors</option>
                  <option value="user">Single user by email</option>
                </select>
              </label>
            </div>

            {audience === "user" && (
              <Input
                type="email"
                placeholder="User email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                required
              />
            )}

            <Button type="submit" disabled={pending}>
              {pending ? "Sending…" : "Send notification"}
            </Button>

            {result && <p className="text-sm text-slate-600">{result}</p>}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
