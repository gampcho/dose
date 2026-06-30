import * as z from "zod"

export const SessionEnum = z.enum([
  "none",
  "morning",
  "noon",
  "afternoon",
  "evening",
])
export const ConditionEnum = z.enum(["none", "before_eat", "after_eat"])

export const Medicine = z.object({
  name: z.string().min(1, "Medicine name is required"),
  quantity: z.number().positive(),
  session: SessionEnum,
  condition: ConditionEnum,
})

/// Save local storage. Verify LLM result.
export const Prescription = z.array(Medicine)

export type MedicineType = z.infer<typeof Medicine>
export type PrescriptionType = z.infer<typeof Prescription>
