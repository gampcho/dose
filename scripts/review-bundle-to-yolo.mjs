#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const [, , inputPath, outputDir = "review-dataset"] = process.argv

if (!inputPath) {
  console.error("Usage: bun run review:dataset <dose-review-bundle.json> [output-dir]")
  process.exit(1)
}

const bundle = JSON.parse(await readFile(inputPath, "utf8"))
const items = Array.isArray(bundle.items) ? bundle.items : []
const imagesDir = path.join(outputDir, "images")
const labelsDir = path.join(outputDir, "labels")

await mkdir(imagesDir, { recursive: true })
await mkdir(labelsDir, { recursive: true })

const manifest = []

for (const item of items) {
  const id = safeId(item.id)
  const imageFile = item.cropImageDataUrl
    ? await writeCrop(id, item.cropImageDataUrl)
    : null
  const labelFile =
    imageFile && typeof item.correctedClassId === "number"
      ? await writeYoloLabel(id, item.correctedClassId)
      : null

  manifest.push({
    id: item.id,
    feedback: item.feedback,
    status: item.status,
    resultName: item.resultName,
    resultClassId: item.resultClassId,
    correctedName: item.correctedName,
    correctedClassId: item.correctedClassId,
    expected: item.expected,
    detected: item.detected,
    confidence: item.confidence,
    bbox: item.bbox,
    imageFile,
    labelFile,
    needsHumanReview: labelFile === null,
  })
}

await writeFile(
  path.join(outputDir, "review_manifest.jsonl"),
  manifest.map((item) => JSON.stringify(item)).join("\n"),
)
await writeFile(
  path.join(outputDir, "summary.json"),
  JSON.stringify(
    {
      source: bundle.source ?? "dose",
      exportedAt: bundle.exportedAt,
      model: bundle.model,
      totalItems: manifest.length,
      crops: manifest.filter((item) => item.imageFile).length,
      labeled: manifest.filter((item) => item.labelFile).length,
      needsHumanReview: manifest.filter((item) => item.needsHumanReview)
        .length,
    },
    null,
    2,
  ),
)

console.log(`Wrote ${manifest.length} review items to ${outputDir}`)

async function writeCrop(id, dataUrl) {
  const parsed = parseDataUrl(dataUrl)
  if (!parsed) return null

  const fileName = `${id}.${parsed.extension}`
  await writeFile(path.join(imagesDir, fileName), parsed.buffer)
  return `images/${fileName}`
}

async function writeYoloLabel(id, classId) {
  const fileName = `${id}.txt`
  await writeFile(path.join(labelsDir, fileName), `${classId} 0.5 0.5 1 1\n`)
  return `labels/${fileName}`
}

function parseDataUrl(dataUrl) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl)
  if (!match) return null

  return {
    extension: extensionForMime(match[1]),
    buffer: Buffer.from(match[2], "base64"),
  }
}

function extensionForMime(mime) {
  if (mime === "image/jpeg") return "jpg"
  if (mime === "image/webp") return "webp"
  return "png"
}

function safeId(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "_")
}
