// Generates editorial landing-page imagery via OpenAI gpt-image-1.
// Usage: node scripts/generate-landing-images.mjs [name1 name2 ...]
// Requires OPENAI_API_KEY in .env.local

import { writeFile, mkdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outDir = resolve(root, "public", "landing");

const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) {
  console.error("Missing OPENAI_API_KEY");
  process.exit(1);
}

const STYLE = `Editorial product photography, museum lighting, soft warm cream background (#F4EFE6), photorealistic, shallow depth of field, magazine quality, intentional negative space, no text or letters anywhere, no logos, no UI elements, contemplative composition, archival print quality.`;

const IMAGES = [
  {
    name: "hero-knowledge-graph",
    size: "1536x1024",
    prompt: `An abstract sculpture representing organizational memory: hundreds of small luminous translucent glass spheres of varying sizes, each containing soft golden light, suspended and connected by impossibly thin gilded threads forming a vast intricate three-dimensional lattice structure. The lattice has clear architectural form — clusters of spheres at three depths, suggesting hierarchy. Photographed from a slight angle on cream linen, soft directional morning light from upper left casting long thoughtful shadows. Fine grain. Warm terracotta highlights at the edges. ${STYLE}`,
  },
  {
    name: "three-tier-rings",
    size: "1024x1024",
    prompt: `Three nested concentric rings made of different translucent materials, viewed slightly from above on warm cream paper. The innermost ring (smallest) is solid carved wood, the middle ring is frosted blown glass with subtle terracotta tint, the outermost ring is delicate cream ceramic with a hairline gold edge. The rings rest on hand-torn cream paper. Soft museum lighting from above-left, casting precise minimal shadows. The composition is centered but with deliberate negative space. ${STYLE}`,
  },
  {
    name: "multi-model-constellation",
    size: "1536x1024",
    prompt: `Five distinct abstract objects arranged in a constellation across a wide cream surface — one matte black obsidian sphere, one terracotta unglazed ceramic cube, one polished brass disk, one frosted glass pyramid, one cream marble torus. Each object is small, photographed from above with soft directional light, casting precise shadows. The objects are connected by impossibly fine drawn graphite lines that suggest a network. Generous negative space between objects. Editorial product photography. ${STYLE}`,
  },
  {
    name: "knowledge-atom",
    size: "1024x1024",
    prompt: `A single luminous translucent crystal sphere, palm-sized, containing flowing internal threads of warm golden light forming a small intricate structure inside, photographed in extreme macro detail on cream linen. The sphere catches soft window light from the upper left, creating gentle highlights and a long contemplative shadow. The internal structure suggests captured knowledge — a delicate web of light. Fine surface grain on the linen. ${STYLE}`,
  },
  {
    name: "reconciliation-dialogue",
    size: "1536x1024",
    prompt: `Two organic translucent forms in quiet dialogue on a cream surface — one form is warm terracotta clay with a matte finish, the other is cool cream porcelain with soft sheen. The forms are suggestive, abstract, almost calligraphic. They lean toward each other, almost touching, suggesting reconciliation. A third form, smaller, sits between them — emerging, formed from the meeting. Soft directional museum light, fine shadows, archival composition. ${STYLE}`,
  },
];

async function generate(image) {
  const body = {
    // Switch to "gpt-image-2" once the org is verified at
    // https://platform.openai.com/settings/organization/general
    model: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1",
    prompt: image.prompt,
    size: image.size,
    quality: "high",
    n: 1,
  };
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${txt}`);
  }
  const json = await res.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image data returned");
  await writeFile(resolve(outDir, `${image.name}.png`), Buffer.from(b64, "base64"));
  return image.name;
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const filter = process.argv.slice(2);
  const targets = filter.length ? IMAGES.filter((i) => filter.includes(i.name)) : IMAGES;

  console.log(`Generating ${targets.length} image(s) into ${outDir}`);
  for (const img of targets) {
    const t0 = Date.now();
    process.stdout.write(`  ${img.name} ... `);
    try {
      await generate(img);
      console.log(`done (${Math.round((Date.now() - t0) / 1000)}s)`);
    } catch (err) {
      console.log(`FAILED`);
      console.error(`    ${err.message}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
