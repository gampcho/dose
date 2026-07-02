import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { describe, expect, test } from "bun:test"

import { findBestFuzzyMatch, findDrug, loadCatalog, searchDrugs } from "../lib/catalog"
import { normalizeLlmMedicine } from "../lib/parser"

let catalogLoaded = false

async function ensureCatalog(): Promise<void> {
  if (catalogLoaded) return

  const realFetch = globalThis.fetch
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url
    if (url === "/models/class_names.json" || url === "/models/drug_groups.json") {
      const fileName = url.split("/").at(-1) ?? ""
      const body = await readFile(join(process.cwd(), "public", "models", fileName), "utf8")
      return new Response(body, { headers: { "Content-Type": "application/json" } })
    }
    return realFetch(input, init)
  }

  await loadCatalog()
  catalogLoaded = true
}

describe("catalog matching", () => {
  test("matches OCR typo for paracetamol", async () => {
    await ensureCatalog()

    expect(findDrug("Parseetamol")?.classIds).toEqual([0])
    expect(findDrug("Parseetamol")?.matchedName).toBe("paracetamol")
  })

  test("keeps existing exact and contains matches", async () => {
    await ensureCatalog()

    expect(findDrug("PARACETAMOL 500MG")?.classIds).toEqual([0])
    expect(findDrug("RENAPRI")?.classIds).toEqual([47])
  })

  test("keeps unknown medicines unknown", async () => {
    await ensureCatalog()

    expect(findDrug("DIAMICRON")).toBe(null)
  })

  test("uses fuzzy matching for autocomplete", async () => {
    await ensureCatalog()

    expect(searchDrugs("Parseetamol")[0]?.name).toBe("paracetamol")
  })

  test("canonicalizes parsed medicine names after catalog matching", async () => {
    await ensureCatalog()

    const med = normalizeLlmMedicine({
      name: "Parseetamol",
      sessions: [{ session: "morning", pills: 1 }],
      unit: "viên",
    })

    expect(med.name).toBe("paracetamol")
    expect(med.classId).toBe(0)
    expect(med.matchedName).toBe("paracetamol")
  })

  test("rejects ambiguous fuzzy candidates", () => {
    expect(findBestFuzzyMatch("abcde", ["abxde", "abzde"])).toBe(null)
  })
})
