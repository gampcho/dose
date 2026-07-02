# DOSE

[![CI](https://github.com/gampcho/dose/actions/workflows/ci.yml/badge.svg)](https://github.com/gampcho/dose/actions)
[![Deploy](https://img.shields.io/badge/demo-live-blue?link=https://dose.lducc-work.workers.dev)](https://dose.lducc-work.workers.dev)

> AI-powered pill tray verification for Vietnamese prescriptions.
> Scan prescription, detect pills, verify match, generate evidence card.

## Overview

Medication errors among elderly patients in Vietnam are a silent crisis. Patients frequently mix up pills, skip doses, or take the wrong medication — often with serious consequences. DOSE tackles this by comparing a photographed prescription against the actual pill tray using browser-based computer vision. Prescription OCR and tray verification run on-device; cloud parsing sends minimized prescription text only.

**Key features:**

- **Privacy-aware AI** — YOLO object detection + OCR run locally in the browser. Cloud parsing sends minimized OCR text only.
- **Vietnamese-first** — Vietnamese prescriptions, drug names, UI, and audio guidance.
- **Evidence card** — every verification produces a visual report with bounding boxes, confidence scores, and pass/fail per pill.
- **Human-in-the-loop MLOps** — uncertain, unknown, and user-corrected detections export as a local review bundle for retraining prep.
- **Caregiver-ready guidance** — spoken Vietnamese instructions plus shareable summaries for family review.

## How It Works

```
                         DOSE Pipeline
                         =============

  ┌─────────────┐                      ┌─────────────┐
  │ Prescription │                      │  Pill Tray   │
  │    Photo     │                      │    Photo     │
  └──────┬──────┘                      └──────┬──────┘
         │                                     │
         ▼                                     ▼
  ┌─────────────┐                      ┌─────────────┐
  │  OCR Engine  │                      │  YOLO12s    │
  │ PP-OCRv5 +   │                      │  (ONNX)     │
  │ Tesseract.js │                      │  108 classes │
  └──────┬──────┘                      └──────┬──────┘
         │                                     │
         ▼                                     ▼
  ┌─────────────┐                      ┌─────────────┐
  │ Groq Parser  │                      │  Detection  │
  │ (sanitized   │                      │  Results    │
  │ OCR text)    │                      │  (bboxes)   │
  └──────┬──────┘                      └──────┬──────┘
         │                                     │
         ▼                                     ▼
  ┌─────────────────────────────────────────────┐
  │           Verification Engine               │
  │   Compare expected pills vs detected pills  │
  └──────────────────────┬──────────────────────┘
                         │
                         ▼
                 ┌───────────────┐
                 │ Evidence Card  │
                 │ PASS / FAIL    │
                 │ + audio guide  │
                 └───────────────┘
```

## Demo Scenarios

Test images are in [`public/demo/`](public/demo/). You can also try the [live demo](https://dose.lducc-work.workers.dev).

Use **Chế độ demo hackathon** on the home screen to seed a deterministic PASS, FAIL, or OOD/manual-check scenario. The demo sets the correct session and tray image automatically, so judges can see the report flow without depending on the current time of day.

| Scenario | Tray image | Description | Result |
| --- | --- | --- | --- |
| Demo đạt | `pilltray_2.png` | RENAPRIL x1 + HOẠT HUYẾT x2, exactly as expected | PASS |
| Demo thiếu thuốc | `pilltray_0.png` | HOẠT HUYẾT x2 present, RENAPRIL x1 missing | FAIL |
| Demo sai khay | `pilltray_1.png` | HOẠT HUYẾT x2 present, NOVOXIM extra, RENAPRIL missing | FAIL |
| Demo cần kiểm tra | `pilltray_2.png` | Known pills match, but DIAMICRON is not in the YOLO model | CẦN KIỂM TRA |

## Review Bundle for MLOps

DOSE keeps feedback local. From a report, choose **Xuất bundle** to download `dose-review-bundle.json`. It includes OOD/unknown meds, unclear detections, missing/extra cases, user corrections, model metadata, bboxes, and pill crops when available.

Convert the exported bundle into a review dataset:

```bash
bun run review:dataset dose-review-bundle.json review-dataset
```

The command writes crop images, optional YOLO labels when a corrected class is known, and a `review_manifest.jsonl` for human review before retraining.

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) (recommended) or Node.js 20+
- A modern browser: Chrome, Edge, Safari, or Firefox

### Local Setup

```bash
git clone https://github.com/gampcho/dose.git
cd dose
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
bun run build
bun run start
```

### Deploy to Cloudflare Pages

```bash
bun run deploy
```

## Tech Stack

| Layer | Technology |
| --- | --- |
| Pill detection | YOLO12s (ONNX Runtime Web, WASM backend) |
| Prescription OCR | PP-OCRv5 detection + Tesseract.js Vietnamese recognition |
| Drug name matching | Bounded fuzzy matching against 108 drug classes |
| Framework | Next.js 16 (App Router, Turbopack) |
| Deployment | Cloudflare Pages (via OpenNext) |
| Inference | OCR + YOLO on-device; Groq parsing sends minimized OCR text |

## Project Structure

```
dose/
├── app/                        # Next.js pages
│   ├── page.tsx                # Home
│   ├── plan/[id]/              # Plan management + OCR
│   └── verify/                 # Global pill tray verification flow
│       └── report/             # Evidence card results
├── lib/
│   ├── ocr.ts                  # Hybrid OCR engine (PP-OCR + Tesseract)
│   ├── yolo.ts                 # YOLO ONNX inference + NMS
│   ├── verification.ts         # Verification logic
│   ├── parser.ts               # Prescription parser backend boundary
│   ├── prescription-sanitizer.ts # OCR text minimization before cloud parsing
│   ├── feedback.ts             # Local review bundle helpers
│   ├── demo.ts                 # Hackathon demo scenario seeding
│   └── storage.ts              # localStorage CRUD
├── public/
│   ├── models/                 # ONNX models (YOLO + PP-OCRv5)
│   ├── demo/                   # Test images for demo scenarios
│   └── *.wasm                  # ONNX Runtime WASM binaries
└── components/                 # UI components
```

## License

MIT
