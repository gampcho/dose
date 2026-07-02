import type { Result } from "@/lib/types"
import type { VerificationResult } from "@/lib/verification"

export function buildReportSpeech(result: VerificationResult): string {
  return [
    statusSentence(result.status),
    summarySentence(result),
    ...result.results.flatMap(resultSentences),
    ...result.identityMeds
      .filter((item) => !item.present)
      .map((item) => `${item.med.name} chưa tìm thấy trong khay. Thuốc này chưa có liều uống, cần kiểm tra bằng mắt.`),
    ...result.unknownMeds.map((med) => `${med.name} chưa có trong model. Cần tự kiểm tra ${med.expected} ${med.unit}.`),
  ].filter(Boolean).join(" ")
}

function statusSentence(status: VerificationResult["status"]): string {
  if (status === "pass") return "Khay thuốc đạt. Không phát hiện sai lệch."
  if (status === "fail") return "Khay thuốc chưa đạt. Vui lòng kiểm tra lại trước khi uống."
  return "Khay thuốc gần đúng, nhưng vẫn cần kiểm tra thủ công trước khi uống."
}

function summarySentence(result: VerificationResult): string {
  const correct = result.results.filter((item) => item.status === "correct").length
  const missing = result.results.filter((item) => item.status === "missing").length
  const extra = result.results.filter((item) => item.status === "extra").length
  const unclear = result.results.filter((item) => item.status === "unclear").length

  if (result.status === "pass") {
    return `Đã kiểm tra ${correct} thuốc theo lịch.`
  }

  const parts = [
    missing > 0 ? `${missing} thuốc bị thiếu` : "",
    extra > 0 ? `${extra} thuốc bị thừa hoặc ngoài kế hoạch` : "",
    unclear > 0 ? `${unclear} thuốc chưa đủ rõ` : "",
  ].filter(Boolean)

  return parts.length > 0 ? `Tóm tắt: ${parts.join(", ")}.` : ""
}

function resultSentences(result: Result): string[] {
  if (result.status === "missing") {
    return [`Thiếu ${result.expected - result.detected} ${result.unit} ${result.name}. Cần ${result.expected}, hiện thấy ${result.detected}.`]
  }
  if (result.status === "extra") {
    if (result.expected === 0) {
      return [`Phát hiện ${result.detected} ${result.unit} ${result.name} ngoài kế hoạch.`]
    }
    return [`Thừa ${result.detected - result.expected} ${result.unit} ${result.name}. Cần ${result.expected}, hiện thấy ${result.detected}.`]
  }
  if (result.status === "unclear") {
    return [`${result.name} chưa đủ rõ để xác nhận. Vui lòng chụp lại gần hơn, đủ sáng hơn.`]
  }
  return []
}
