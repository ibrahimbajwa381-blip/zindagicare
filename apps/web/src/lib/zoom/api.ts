import { getZoomConfig } from "./config";

export type ZoomMeeting = {
  id: number;
  password: string;
  join_url: string;
  start_url: string;
};

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

async function getZoomAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60_000) {
    return cachedAccessToken.token;
  }

  const { accountId, clientId, clientSecret } = getZoomConfig();
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
      },
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zoom OAuth failed (${res.status}): ${body}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = {
    token: json.access_token,
    expiresAt: now + json.expires_in * 1000,
  };

  return json.access_token;
}

export async function createZoomMeeting(input: {
  topic: string;
  startTime: Date;
  durationMinutes: number;
  timezone: string;
}): Promise<ZoomMeeting> {
  const token = await getZoomAccessToken();
  const { hostUserId } = getZoomConfig();

  const res = await fetch(
    `https://api.zoom.us/v2/users/${encodeURIComponent(hostUserId)}/meetings`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic: input.topic,
        type: 2,
        start_time: input.startTime.toISOString(),
        duration: input.durationMinutes,
        timezone: input.timezone,
        settings: {
          join_before_host: true,
          waiting_room: false,
          approval_type: 0,
          meeting_authentication: false,
          mute_upon_entry: false,
          auto_recording: "none",
        },
      }),
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const body = await res.text();
    let hint = "";
    if (body.includes("Invalid access token") || body.includes("does not contain scopes")) {
      hint =
        " Check your Server-to-Server app scopes include meeting:write:meeting:admin and that the app is activated.";
    } else if (res.status === 404 || body.includes("User does not exist")) {
      hint = ` Set ZOOM_HOST_USER_ID to the licensed Zoom host email (currently "${hostUserId}").`;
    }
    throw new Error(`Zoom create meeting failed (${res.status}): ${body}${hint}`);
  }

  return res.json() as Promise<ZoomMeeting>;
}
