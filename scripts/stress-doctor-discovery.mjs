/**
 * Read-only stress/load test against the live Doctor Discovery endpoint.
 * Issues graduated waves of concurrent GET requests and reports latency
 * percentiles, error rates, and any non-200/malformed responses.
 *
 * No writes performed by this script itself (GET only). The route's own
 * internal expireStalePendingBookings() no-op housekeeping call still runs
 * as part of normal request handling (pre-existing app behavior, previously
 * disclosed and approved).
 */
const BASE = "http://localhost:3000/api/v1/consult/doctors";

const SCENARIOS = [
  { city: "Lahore" },
  { city: "Lahore", specialty: "Cardiologist" },
  { city: "Karachi" },
  { city: "Islamabad", specialty: "General Physician" },
  { city: "" }, // edge case under load
  { city: "Lahore", specialty: "SpecialtyThatDoesNotExist123" },
];

function buildUrl(params) {
  const url = new URL(BASE);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

async function fireOne(i) {
  const scenario = SCENARIOS[i % SCENARIOS.length];
  const url = buildUrl(scenario);
  const start = performance.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
    const elapsed = performance.now() - start;
    let bodyOk = false;
    let dataLen = -1;
    try {
      const json = await res.json();
      bodyOk = json && typeof json.success === "boolean";
      dataLen = Array.isArray(json.data) ? json.data.length : -1;
    } catch {
      bodyOk = false;
    }
    return { ok: res.status === 200 && bodyOk, status: res.status, elapsed, dataLen };
  } catch (err) {
    const elapsed = performance.now() - start;
    return { ok: false, status: 0, elapsed, error: String(err) };
  }
}

function percentile(sorted, p) {
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function runWave(concurrency) {
  const start = performance.now();
  const results = await Promise.all(Array.from({ length: concurrency }, (_, i) => fireOne(i)));
  const totalElapsed = performance.now() - start;

  const successes = results.filter((r) => r.ok);
  const failures = results.filter((r) => !r.ok);
  const latencies = results.map((r) => r.elapsed).sort((a, b) => a - b);

  console.log(`\n=== Wave: ${concurrency} concurrent requests ===`);
  console.log(`  wall time: ${totalElapsed.toFixed(0)}ms`);
  console.log(`  success: ${successes.length}/${concurrency} (${((successes.length / concurrency) * 100).toFixed(1)}%)`);
  console.log(`  failures: ${failures.length}`);
  if (failures.length) {
    const byStatus = {};
    for (const f of failures) {
      const key = f.status === 0 ? `network:${f.error?.slice(0, 60)}` : `http:${f.status}`;
      byStatus[key] = (byStatus[key] ?? 0) + 1;
    }
    console.log(`  failure breakdown:`, byStatus);
  }
  console.log(`  latency (ms) — min: ${latencies[0]?.toFixed(0)}, p50: ${percentile(latencies, 50).toFixed(0)}, p95: ${percentile(latencies, 95).toFixed(0)}, p99: ${percentile(latencies, 99).toFixed(0)}, max: ${latencies[latencies.length - 1]?.toFixed(0)}`);

  return { concurrency, successes: successes.length, failures: failures.length, totalElapsed };
}

async function main() {
  console.log("Doctor Discovery stress test — live server at", BASE);
  const waves = [1500, 3000];
  const summary = [];
  for (const c of waves) {
    const result = await runWave(c);
    summary.push(result);
    // brief pause between waves so we can see recovery, not just cumulative pileup
    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log("\n=== SUMMARY ===");
  for (const s of summary) {
    console.log(
      `concurrency=${s.concurrency}: ${s.successes}/${s.concurrency} ok, wall=${s.totalElapsed.toFixed(0)}ms`,
    );
  }
}

main().catch((err) => {
  console.error("Stress test crashed:", err);
  process.exit(1);
});
