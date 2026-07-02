export const MAX_PARSE_TEXT_CHARS = 6000

const PII_PATTERNS = [
  /họ\s*tên|ho\s*ten|bệnh\s*nhân|benh\s*nhan|patient|name/i,
  /địa\s*chỉ|dia\s*chi|address|số\s*điện\s*thoại|dien\s*thoai|phone|tel/i,
  /tuổi|tuoi|năm\s*sinh|nam\s*sinh|birth|dob|giới\s*tính|gioi\s*tinh/i,
  /bhyt|bảo\s*hiểm|bao\s*hiem|mã\s*số|ma\s*so|\b(id|cccd|cmnd)\b/i,
]

const ADMIN_PATTERNS = [
  /bệnh\s*viện|benh\s*vien|phòng\s*khám|phong\s*kham|sở\s*y\s*tế|so\s*y\s*te/i,
  /khoa|bác\s*sĩ|bac\s*si|bs\.?|doctor|chẩn\s*đoán|chan\s*doan|diagnosis/i,
  /ngày|tháng|năm|date|khám\s*lại|tai\s*kham|tái\s*khám/i,
]

const MEDICINE_SIGNAL_PATTERNS = [
  /sáng|trưa|chiều|tối|sang|trua|chieu|toi/i,
  /trước\s*ăn|sau\s*ăn|truoc\s*an|sau\s*an/i,
  /viên|ống|gói|chai|vien|ong|goi/i,
  /\d+(?:[,.]\d+)?\s*(?:mg|g|ml|mcg|ui)\b/i,
  /^\s*\d+[\).:-]\s*\S+/,
]

export function sanitizePrescriptionText(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((line) => !isSensitiveLine(line))

  const selected = selectMedicineContext(lines)
  const sanitized = (selected.length > 0 ? selected : lines).join("\n")
  return sanitized.slice(0, MAX_PARSE_TEXT_CHARS).trim()
}

function isSensitiveLine(line: string): boolean {
  return PII_PATTERNS.some((pattern) => pattern.test(line)) ||
    ADMIN_PATTERNS.some((pattern) => pattern.test(line))
}

function selectMedicineContext(lines: string[]): string[] {
  const selected = new Set<number>()

  lines.forEach((line, index) => {
    if (!hasMedicineSignal(line)) return
    selected.add(index)
    if (index > 0) selected.add(index - 1)
    if (index < lines.length - 1) selected.add(index + 1)
  })

  return Array.from(selected)
    .sort((a, b) => a - b)
    .map((index) => lines[index])
}

function hasMedicineSignal(line: string): boolean {
  return MEDICINE_SIGNAL_PATTERNS.some((pattern) => pattern.test(line))
}
