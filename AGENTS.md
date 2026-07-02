# DOSE — Pill Tray Verification PWA

Vietnamese pill tray verification. User creates a treatment plan from a prescription photo, then verifies their pill tray matches. All AI runs on-device.

## User Flow (3 steps)

```
Home                 Plan                Verify → Report
─────                ────                ───────────────
Create plan    →     Add medications  →    Photograph tray
                     (OCR or manual)       See PASS/FAIL/CẦN KIỂM TRA
```

**Home** — lists plans. Each plan has "Quản lý thuốc" (add/edit meds). Prominent "Kiểm tra khay thuốc hôm nay" button for global verification.

**Plan** (`/plan/[id]`) — add medications via OCR (upload prescription photo) or manual entry with autocomplete against the YOLO drug catalog. Set session doses (Sáng/Trưa/Chiều/Tối), meal timing, notes.

**Verify** (`/verify`) — global verification. Optional meal timing toggle (Trước ăn/Sau ăn). Photograph pill tray. Camera or file upload.

**Report** (`/verify/report`) — YOLO detects pills in photo. System compares detected pills against ALL plans' expected medications for the current time of day. Shows:

| Section                      | Shows                                                                            |
| ---------------------------- | -------------------------------------------------------------------------------- |
| Known drugs (with doses)     | Expected vs detected count per drug. Status: correct / missing / extra / unclear |
| Identity-only (no doses set) | "Có trong khay ✓" or "Không tìm thấy ✗" — presence check only                    |
| Unknown (not in YOLO model)  | Amber warning box. Manual verification needed.                                   |

Buttons: "Chụp lại" (retake photo), "Về trang chủ" (go home).

---

## Data Model

### Domain Types (`lib/types/index.ts`)

Everything is a plain TypeScript interface. No runtime validation needed.

```typescript
Session     = "morning" | "noon" | "afternoon" | "evening"
MealTiming  = "before" | "after" | null

Dose        = { session: Session, pillCount: number }
// A single intake. "Sáng 2 viên" → { session: "morning", pillCount: 2 }

Medication  = { id, name, classId: number|null, doses: Dose[],
                mealTiming: MealTiming, unit: string, notes, createdAt }
// A drug in a treatment plan.
// classId = YOLO class (0-107). null = unknown/not-in-model.
// doses = [] means no session info → identity-only check.
// unit = "viên" | "ống" | "gói" | "chai" — drug form from LLM extraction.

Plan        = { id, name, medications: Medication[], createdAt }
// One treatment plan. Stored in localStorage.

ParsedMed   = { name, classId, matchedName, quantity, dosage, unit,
                doses: Dose[], mealTiming }
// Parser output. Transient — converted to Medication on save.

Result      = { classId, name, expected, detected, confidence, unit,
                status: "correct" | "missing" | "extra" | "unclear" }
// Verification output. One row per YOLO class.
// "unclear" triggers when confidence < 0.65 → "vui lòng chụp lại".
```

`SESSION_LABELS` = `{ morning: "Sáng", noon: "Trưa", afternoon: "Chiều", evening: "Tối" }`

`getCurrentSession(now?)` = maps hour to session: 5-10→morning, 10-14→noon, 14-18→afternoon, 18-5→evening.

### Zod Schemas (`types/index.ts`)

Only used by the LLM API route. Not used in the app itself.

The Zod `SessionEnum` includes `"none"` because LLMs can't always determine a session from OCR text. The parser maps `"none"` → null. Domain types don't have `"none"` — empty `doses` means no session info.

Domain types (`lib/types`) are plain interfaces for app state. Zod schemas (`types`) are runtime validation for external LLM input. Two files, two purposes.

---

## Drug Matching (`lib/catalog.ts`)

Maps a drug name (from OCR or manual entry) to YOLO class IDs.

### Data files

| File                             | Content                                                                                 |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| `public/models/class_names.json` | `{ "0": "paracetamol 500mg", "1": "troysar am 5mg", ... }` — 108 YOLO classes           |
| `public/models/drug_groups.json` | `{ "paracetamol": [0], "novoxim-500": [10, 82], ... }` — 87 drug name → class ID arrays |

`drug_groups.json` is generated from `class_names.json` by stripping dosages and grouping equivalent names. Multiple class IDs per drug handle YOLO training variations (e.g., same drug in different packaging → different classes).

### Matching algorithm

`findDrug(text)` → `{ classIds, matchedName } | null`

Three explicit, named steps. No Levenshtein. No `normalize()`.

1. **`stripDosage`** — removes dosage units (`\d+[,.]?\d*\s*(mg|g|ml|mcg|ui)`)
2. **`cleanForLookup`** — lowercase, replace punctuation with spaces, collapse whitespace. Keeps Vietnamese Unicode characters.
3. **Exact match** in cleaned catalog map → if not found, **contains match** (key includes input or input includes key)

Examples:

```
"PARACETAMOL 500MG" → "paracetamol" → exact → [0] ✓
"RENAPRI" (truncated) → "renapri" → "renapril".includes("renapri") → [47] ✓
"HOẠT HUYẾT DƯỠNG NÃO" → exact match after cleaning → [64] ✓
"DIAMICRON" → not in catalog → null ✓
```

### Other exports

- `loadCatalog()` — fetches JSON files, builds lookup maps. Cached module-level. Call before `findDrug` or `searchDrugs`.
- `searchDrugs(query)` — returns up to 8 matching drugs for autocomplete. Same matching logic as `findDrug`.
- `comparePills(expected, detections, unitMap)` — takes `{ classId→count }` expected map + YOLO detections + `{ classId→unit }` map, returns `Result[]`. Status includes `"unclear"` when confidence < 0.65.

---

## Prescription Parser (`lib/parser.ts`)

LLM-only parser. No rule-based fallback.

### How it works

1. OCR extracts text from prescription photo (PaddleOCR detection + Tesseract recognition).
2. `parseWithLLM(text)` sends raw OCR text to Groq API (`llama-3.3-70b-versatile`).
3. LLM extracts: drug name, sessions (sáng→morning, trưa→noon, chiều→afternoon, tối→evening), dosage, unit (viên/ống/gói/chai), quantity, meal timing.
4. `findDrug()` maps each extracted name to YOLO class IDs.
5. Returns `ParsedMed[]` for user to review and save.

### Failure states

- OCR text < 10 chars → "Không đọc được đơn thuốc, vui lòng nhập tay"
- LLM returns 0 results → "Không nhận diện được thuốc, vui lòng nhập tay"
- LLM API error → "Không đọc được đơn thuốc, vui lòng nhập tay"

---

## Verification Engine (`lib/verification.ts`)

Shared verification logic used by `/verify/report`.

### Input

- `plans: Plan[]` — all saved treatment plans
- `detections: Detection[]` — YOLO detections from tray photo
- `session: Session` — current time session
- `mealTiming: MealTiming` — optional meal timing filter

### Output

```typescript
VerificationResult = {
  results: Result[]           // known scheduled meds with status
  identityMeds: IdentityMed[] // identity-only meds (no doses)
  unknownMeds: Medication[]   // meds not in YOLO model
  unknownDetected: number     // detected pills matching unknown meds
  status: "pass" | "fail" | "manual_check"
}
```

### How it works

1. Merges all medications from all plans.
2. For each med, classifies into: scheduled (has doses for current session), identity (no doses), unknown (not in model).
3. For scheduled meds, builds expected map and runs `comparePills()`.
4. Merges multi-class drug results (same drug, different YOLO classes).
5. Computes overall status:
   - **PASS**: all scheduled known meds match, no extras/unclears
   - **FAIL**: any scheduled known med is missing/extra/unclear
   - **MANUAL_CHECK**: scheduled meds pass, but identity-only meds absent or unknown meds detected

### Status values

| Status         | Meaning                           | Badge Color |
| -------------- | --------------------------------- | ----------- |
| `pass`         | All scheduled meds match          | Green       |
| `fail`         | Missing, extra, or unclear meds   | Red         |
| `manual_check` | Identity/unknown meds need review | Amber       |

---

## OCR Pipeline (`lib/ocr.ts`)

**Hybrid: PaddleOCR detection + Tesseract.js recognition.**

Why two engines? PaddleOCR's built-in recognition (`rec.onnx`) had insufficient Vietnamese accuracy. Tesseract's `vie` language pack produces better results for Vietnamese prescription text. The `paddleocr` npm package is used only for its detection model (`det.onnx`) — it finds text regions. Tesseract reads the Vietnamese text inside each region.

This is intentionally a hybrid, not wasteful duplication. Both engines serve different purposes.

---

## YOLO Detection (`lib/yolo.ts`)

### Model: YOLO12s onnx

108 classes (0-107), class 107 = "ngoài đơn" (out-of-prescription).
Model at `public/models/vaipe12n.onnx` (18 MB, FP32).

### Config

```
INPUT_SIZE = 640        lettersbox to 640×640
CONF_THRESHOLD = 0.25   low threshold — NMS handles false positives
IOU_THRESHOLD = 0.5     non-max suppression overlap
nc = 108                number of classes
```

### Pipeline

```
loadImage() → letterbox(640×640) → ort.run() → parse tensor → NMS → Detection[]
```

Output tensor layout is Ultralytics YOLO export format: `[cx, cy, w, h, cls0...cls107]` per anchor, `[1, 112, 8400]` total.

---

## LLM Fallback (`app/api/parse/route.ts`)

### When it triggers

`parseWithLLM()` is called for every OCR text > 10 chars. This is the primary parsing path.

### How it works

1. Route receives `{ text }` (raw OCR output).
2. Sends text to **Groq API** (`llama-3.3-70b-versatile`).
3. Validates response with Zod `Prescription` schema.
4. Returns `{ prescription: MedicineType[] }`.

### Config

```
GROQ_API_KEY  — in .env, required for LLM parsing
Model         — llama-3.3-70b-versatile (hardcoded)
Temperature   — 0.1 (deterministic)
Max tokens    — 1024
```

No user consent prompt — silent auto-call when user uploads prescription photo.

---

## Storage (`lib/storage.ts`)

All data in `localStorage`. Key: `dose:plans` → `Plan[]` JSON.

| Function           | Purpose                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------- |
| `listPlans()`      | Reads + migrates old field names (`schedules`→`doses`, strips `known`). Returns `Plan[]`. |
| `getPlan(id)`      | Finds one plan.                                                                           |
| `upsertPlan(plan)` | Creates or updates.                                                                       |
| `deletePlan(id)`   | Removes from list.                                                                        |
| `generateId()`     | `crypto.randomUUID()`.                                                                    |

### Migration

Old plans stored with `schedules` (old field name) or `known` (removed field) are auto-migrated on read. `migrateMed()` handles field renames. Written plans always use the current schema.

### Cross-page data

`dose:verify:global:image` — tray photo URL stored in `sessionStorage`. Written by verify page, read by report page.

`dose:verify:global:meal` — meal timing selection, same sessionStorage pattern.

---

## File Structure

```
dose/
├── types/
│   └── index.ts           Zod schemas (LLM response validation only)
├── lib/
│   ├── types/
│   │   └── index.ts       Domain types (Plan, Medication, Result, ParsedMed, etc.)
│   ├── catalog.ts         Drug matching + verification counting
│   ├── verification.ts    Shared verification engine
│   ├── parser.ts          LLM-only prescription parser
│   ├── storage.ts         localStorage CRUD + migration
│   ├── ocr.ts             PaddleOCR detect + Tesseract recognize
│   ├── yolo.ts            YOLO12s ONNX inference
│   └── utils.ts           cn() Tailwind class merge
├── app/
│   ├── page.tsx           Home — plan list, create, delete, global verify button
│   ├── layout.tsx         Root HTML, fonts (light-only, no theme provider)
│   ├── plan/[id]/
│   │   └── page.tsx       Medication management (OCR + manual add, edit, delete)
│   ├── verify/
│   │   ├── page.tsx       Global tray capture, meal timing
│   │   └── report/
│   │       └── page.tsx   YOLO analysis, shared verification, result display
│   └── api/parse/
│       └── route.ts       LLM fallback endpoint
├── components/
│   ├── common/
│   │   ├── medication-card.tsx   One medication (name, doses, notes)
│   │   ├── session-row.tsx       Session toggle + pill count stepper
│   │   ├── result-row.tsx        One verification result (correct/missing/extra/unclear)
│   │   └── bbox-overlay.tsx      Canvas-based YOLO bounding boxes
│   └── ui/
│       ├── button.tsx, badge.tsx, card.tsx, dialog.tsx,
│       ├── input.tsx, checkbox.tsx, separator.tsx
│       └── sonner.tsx, tooltip.tsx  (unused, kept — delete if confirmed)
├── public/
│   └── models/
│       ├── vaipe12n.onnx    YOLO12s (18 MB)
│       ├── det.onnx         PaddleOCR detection (4.6 MB)
│       ├── rec.onnx         PaddleOCR recognition (10.3 MB, needed for init)
│       ├── dict.txt          Vietnamese character set
│       ├── class_names.json  108 YOLO classes
│       └── drug_groups.json  87 drug name → class ID arrays
└── .env                     GROQ_API_KEY (single variable)
```

---

## Design Choices

### Two type files

`types/index.ts` (Zod) validates LLM output at runtime. `lib/types/index.ts` (TS interfaces) defines app state. The Zod `SessionEnum` includes `"none"` — domain `Session` uses empty `doses` for the same purpose.

### classId over `known` boolean

One field instead of two. `classId: null` means untracked. `classId: 47` means `renapril 5mg`. No ambiguity.

### Session-aware verification

Pills in a tray are for one session. Summing all doses (morning + evening) would expect 4 when the tray has 2. Filtering by `getCurrentSession()` gives the correct expected count.

### Auto-detect session

Most users verify at the time they take pills. No manual toggle needed. Verifying the wrong session shows "extra" pills — correct feedback: those pills shouldn't be in the tray now.

### Meal timing toggle

If a drug says "trước ăn" and the user hasn't eaten, those pills should be in the tray. The toggle on the capture page filters by meal timing. Default is null — no filter.

### Global verification

One tray contains pills from all prescriptions. Global `/verify` merges all plans and checks against one photo. Per-plan verification removed to keep the flow simple.

### Hybrid OCR

PaddleOCR finds text regions. Tesseract reads Vietnamese text inside each region. Paddle's `rec.onnx` is loaded because the `paddleocr` npm package requires both models for initialization, but its recognition output is discarded in favor of Tesseract's better Vietnamese accuracy.

### LLM-only parser

No rule-based parser. LLM handles messy OCR text, multi-session extraction, unit detection. Simpler codebase, better accuracy.

### localStorage over IndexedDB

Plans are small JSON arrays. `migrateMed()` handles field renames on read. Simple reads/writes. No schema migrations needed.

---

## Edge Cases

| Case                                  | Behavior                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------- |
| No sessions on a drug                 | Identity-only check. "Có trong khay ✓" or "Không tìm thấy ✗".             |
| Drug not in YOLO model                | Amber warning box. "Thuốc chưa có trong model, sẽ cần kiểm tra thủ công". |
| Pills detected with confidence < 0.65 | `"unclear"` status. Amber warning. "Vui lòng chụp lại".                   |
| Empty tray (0 detections)             | All expected → missing. Normal FAIL.                                      |
| Pill in tray but wrong session        | `"extra"` — shows as detected but unexpected.                             |
| Old localStorage data                 | `migrateMed()` converts `schedules`→`doses`, drops `known`.               |
| OCR reads "RENAPRI" (truncated)       | `findDrug` substring match → "renapril" → class 47 ✓                      |
| Multiple drugs in prescription        | OCR parses all. User selects which to save.                               |
| Manual entry with catalog match       | Autocomplete dropdown → pick → classId auto-set.                          |
| No `GROQ_API_KEY` in `.env`           | LLM fallback returns empty. Shows "nhập thủ công" prompt.                 |
| OCR/LLM failure                       | Amber error message: "Không đọc được đơn thuốc, vui lòng nhập tay".       |

---

## Constraints

- **108 YOLO classes** (0-106 named medicines, 107 = ngoài đơn). New drugs cannot be added without retraining.
- **On-device inference** — YOLO + OCR run in browser. No images leave the device.
- **Vietnamese-first** — all UI, labels, drug names in Vietnamese.
- **Minimal code** — no comments unless the logic isn't obvious from the name. Functions under 25 lines where possible.
- **No dependencies on external APIs at runtime** — LLM fallback is optional (gated by `GROQ_API_KEY`).
- **Light-only UI** — no dark mode, no theme provider.
