import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const root = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(root, "../.env.local");

for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  const value = trimmed.slice(eq + 1).trim();
  if (!process.env[key]) process.env[key] = value;
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_STORAGE_BUCKET;

if (!url || !key || !bucket) {
  console.error("FAIL: Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or SUPABASE_STORAGE_BUCKET");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const testPath = `_healthcheck/${Date.now()}.txt`;
const body = Buffer.from("zindagicare-storage-ok");

console.log("Testing Supabase Storage...");
console.log(`  URL: ${url}`);
console.log(`  Bucket: ${bucket}`);
console.log(`  Key prefix: ${key.slice(0, 8)}...`);

const { error: uploadError } = await supabase.storage.from(bucket).upload(testPath, body, {
  contentType: "text/plain",
  upsert: false,
});

if (uploadError) {
  console.error("FAIL: Upload error:", uploadError.message);
  if (uploadError.message.includes("Bucket not found")) {
    console.error("Hint: Create a private bucket named", bucket, "in Supabase Storage.");
  }
  if (uploadError.message.includes("Invalid API key") || uploadError.message.includes("JWT")) {
    console.error("Hint: Use the service_role key from Project Settings → API (starts with eyJ...).");
  }
  process.exit(1);
}

const { data, error: downloadError } = await supabase.storage.from(bucket).download(testPath);

if (downloadError || !data) {
  console.error("FAIL: Download error:", downloadError?.message ?? "no data");
  process.exit(1);
}

const text = await data.text();
if (text !== "zindagicare-storage-ok") {
  console.error("FAIL: Downloaded content mismatch");
  process.exit(1);
}

await supabase.storage.from(bucket).remove([testPath]);

console.log("OK: Upload, download, and delete all succeeded.");
