import { describe, expect, test } from "bun:test"

import { buildReportSpeech } from "../lib/report-speech"
import type { VerificationResult } from "../lib/verification"

const base: VerificationResult = {
  results: [],
  identityMeds: [],
  unknownMeds: [],
  status: "pass",
}

describe("buildReportSpeech", () => {
  test("summarizes passing reports", () => {
    expect(buildReportSpeech(base)).toContain("Khay thuốc đạt")
  })

  test("summarizes missing, extra, unclear, and manual-check items", () => {
    const speech = buildReportSpeech({
      ...base,
      status: "fail",
      results: [
        {
          classId: 1,
          name: "paracetamol",
          expected: 2,
          detected: 1,
          confidence: 0.9,
          unit: "viên",
          status: "missing",
        },
        {
          classId: 2,
          name: "atoris",
          expected: 0,
          detected: 1,
          confidence: 0.9,
          unit: "viên",
          status: "extra",
        },
        {
          classId: 3,
          name: "renapril",
          expected: 1,
          detected: 1,
          confidence: 0.4,
          unit: "viên",
          status: "unclear",
        },
      ],
      unknownMeds: [
        {
          id: "unknown",
          name: "DIAMICRON",
          classId: null,
          doses: [],
          mealTiming: null,
          unit: "viên",
          notes: "",
          createdAt: "",
          expected: 1,
        },
      ],
    })

    expect(speech).toContain("Thiếu 1 viên paracetamol")
    expect(speech).toContain("Có thuốc ngoài kế hoạch: atoris")
    expect(speech).toContain("renapril chưa đủ rõ")
    expect(speech).toContain("DIAMICRON cần kiểm tra thủ công")
  })
})
