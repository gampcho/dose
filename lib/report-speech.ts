import type { Result } from "@/lib/types"
import type { VerificationResult } from "@/lib/verification"

export function buildReportSpeech(result: VerificationResult): string {
  return [
    statusSentence(result.status),
    ...result.results.flatMap(resultSentences),
    ...result.identityMeds
      .filter((item) => !item.present)
      .map((item) => `${item.med.name} không tìm thấy trong khay.`),
    ...result.unknownMeds.map((med) => `${med.name} cần kiểm tra thủ công.`),
  ].filter(Boolean).join(" ")
}

function statusSentence(status: VerificationResult["status"]): string {
  if (status === "pass") return "Khay thuốc đạt. Không phát hiện sai lệch."
  if (status === "fail") return "Khay thuốc chưa đạt."
  return "Khay thuốc cần kiểm tra thủ công."
}

function resultSentences(result: Result): string[] {
  if (result.status === "missing") {
    return [`Thiếu ${result.expected - result.detected} ${result.unit} ${result.name}.`]
  }
  if (result.status === "extra") {
    return [`Có thuốc ngoài kế hoạch: ${result.name}.`]
  }
  if (result.status === "unclear") {
    return [`${result.name} chưa đủ rõ, vui lòng chụp lại.`]
  }
  return []
}
