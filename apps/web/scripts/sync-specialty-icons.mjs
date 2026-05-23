/**
 * Copies Health Icons (CC0) into public/browse/specialties/{slug}.svg
 * Run: node scripts/sync-specialty-icons.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");
const labelsPath = path.join(webRoot, "src/features/marketing/data/specialty-labels.ts");
const outDir = path.join(webRoot, "public/browse/specialties");

const HI_BASE =
  "https://raw.githubusercontent.com/resolvetosavelives/healthicons/main/public/icons/svg/filled";

function slugify(label) {
  return label
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function extractLabels(source) {
  const match = source.match(/export const SPECIALTY_LABELS = \[([\s\S]*?)\] as const/);
  if (!match) throw new Error("Could not parse SPECIALTY_LABELS");
  return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

/** @returns {`${string}/${string}.svg`} */
function resolveIconRelPath(label) {
  const l = label.toLowerCase();

  if (l.includes("dermat") || l.includes("cosmet") || l.includes("aesthetic") || l.includes("laser"))
    return "conditions/allergies.svg";
  if (l.includes("gynec") || l.includes("obstetric") || l.includes("fertility") || l.includes("maternal"))
    return "body/female_reproductive_system.svg";
  if (l.includes("neonat")) return "people/child_care.svg";
  if (l.includes("pediatric") || l.includes("child"))
    return "people/child_care.svg";
  if (l.includes("orthopedic") || l.includes("orthotist") || l.includes("chiropractor"))
    return "body/joints.svg";
  if (l.includes("physio") || l.includes("rehab") || l.includes("occupational therapist"))
    return "exercise/walk_supported.svg";
  if (l.includes("fitness")) return "exercise/running.svg";
  if (l.includes("speech") || l.includes("audiolog")) return "body/ear.svg";
  if (l.includes("ent") || l.includes("head and neck")) return "body/ear.svg";
  if (l.includes("eye") || l.includes("optomet") || l.includes("vitreo"))
    return "body/eye.svg";
  if (l.includes("dent") || l.includes("tooth") || l.includes("orthodont") || l.includes("implant") || l.includes("prosthodont") || l.includes("periodont") || l.includes("endodont") || l.includes("operative dentistry") || l.includes("maxillofacial"))
    return "body/tooth.svg";
  if (l.includes("psych") || l.includes("counsel") || l.includes("autism") || l.includes("mental"))
    return "people/mental_disorders.svg";
  if (l.includes("neuro")) return "body/neurology.svg";
  if (l.includes("cardio") || l.includes("heart") || l.includes("hypertension"))
    return "body/heart_organ.svg";
  if (l.includes("pulmon") || l.includes("asthma") || l.includes("thoracic") || l.includes("respiratory"))
    return "body/lungs.svg";
  if (l.includes("gastro") || l.includes("hepat") || l.includes("colorectal"))
    return "body/stomach.svg";
  if (l.includes("urolog") || l.includes("andro") || l.includes("sex"))
    return "body/bladder.svg";
  if (l.includes("nephro") || l.includes("renal") || l.includes("kidney"))
    return "body/kidneys.svg";
  if (l.includes("diabet") || l.includes("endocrin"))
    return "body/pancreas.svg";
  if (l.includes("oncolog") || l.includes("cancer") || l.includes("tumour"))
    return "body/tumour.svg";
  if (l.includes("hemato") || l.includes("histopath") || l.includes("patholog"))
    return "body/blood-cells.svg";
  if (l.includes("immun")) return "body/antibody.svg";
  if (l.includes("radiolog") || l.includes("nuclear medicine") || l.includes("sonolog"))
    return "devices/xray.svg";
  if (l.includes("anesthes")) return "devices/medicine.svg";
  if (l.includes("nutrition") || l.includes("dietitian"))
    return "nutrition/fruits.svg";
  if (l.includes("obesity") || l.includes("bariatric"))
    return "conditions/overweight.svg";
  if (l.includes("pain")) return "conditions/pain.svg";
  if (l.includes("burn")) return "conditions/burn.svg";
  if (l.includes("sleep")) return "emotions/sleepy.svg";
  if (l.includes("podiat") || l.includes("foot")) return "body/foot.svg";
  if (l.includes("spinal") || l.includes("spine")) return "body/spine.svg";
  if (l.includes("thyroid")) return "body/thyroid.svg";
  if (l.includes("breast")) return "body/breasts.svg";
  if (l.includes("hernia")) return "body/intestine.svg";
  if (l.includes("hand")) return "body/arm.svg";
  if (l.includes("vascular") || l.includes("endovascular"))
    return "body/blood_vessel.svg";
  if (l.includes("plastic") || l.includes("reconstructive") || l.includes("hair transplant"))
    return "body/head.svg";
  if (l.includes("emergency") || l.includes("critical care"))
    return "symbols/ambulance.svg";
  if (l.includes("community medicine")) return "people/world_care.svg";
  if (l.includes("homeopath") || l.includes("naturopathic") || l.includes("alternative medicine") || l.includes("acupunct"))
    return "symbols/medicines.svg";
  if (l.includes("rheumat")) return "body/joints.svg";
  if (l.includes("geriatric")) return "people/elderly.svg";
  if (l.includes("sports")) return "exercise/weights.svg";
  if (l.includes("surgeon") || l.includes("surgery")) return "symbols/surgical_sterility_outline.svg";
  if (l.includes("medicine specialist") || l.includes("physician") || l.includes("consultant"))
    return "people/doctor.svg";

  return "people/doctor.svg";
}

const FALLBACK = "people/doctor.svg";

async function fetchSvg(relPath) {
  const url = `${HI_BASE}/${relPath}`;
  const res = await fetch(url);
  if (!res.ok) {
    if (relPath === FALLBACK) throw new Error(`Failed ${url}: ${res.status}`);
    console.warn(`Missing ${relPath}, using ${FALLBACK}`);
    return fetchSvg(FALLBACK);
  }
  return res.text();
}

async function main() {
  const labels = extractLabels(fs.readFileSync(labelsPath, "utf8"));
  fs.mkdirSync(outDir, { recursive: true });

  const cache = new Map();

  for (const label of labels) {
    const slug = slugify(label);
    const rel = resolveIconRelPath(label);
    if (!cache.has(rel)) {
      cache.set(rel, await fetchSvg(rel));
    }
    let svg = cache.get(rel);
    svg = svg.replace(/fill="currentColor"/g, 'fill="#334155"');
    fs.writeFileSync(path.join(outDir, `${slug}.svg`), svg);
    console.log(`${slug} <- ${rel}`);
  }

  console.log(`\nSynced ${labels.length} specialty icons.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
