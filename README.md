# DOSE

[![CI](https://github.com/gampcho/dose/actions/workflows/ci.yml/badge.svg)](https://github.com/gampcho/dose/actions)
[![Deploy](https://img.shields.io/badge/demo-live-blue?link=https://dose.lducc-work.workers.dev)](https://dose.lducc-work.workers.dev)

> AI-powered pill tray verification for Vietnamese prescriptions.
> Scan prescription, detect pills, verify match, generate evidence card — entirely on-device.

## Overview

Medication errors among elderly patients in Vietnam are a silent crisis. Patients frequently mix up pills, skip doses, or take the wrong medication — often with serious consequences. DOSE tackles this by comparing a photographed prescription against the actual pill tray using computer vision, running 100% in the browser with zero data leaving the device.

**Key features:**

- **On-device AI** — YOLO object detection + OCR run locally in the browser. No cloud inference, no privacy risk.
- **Vietnamese-first** — Vietnamese prescriptions, drug names, UI, and audio guidance.
- **Evidence card** — every verification produces a visual report with bounding boxes, confidence scores, and pass/fail per pill.
- **PWA** — installable on any phone, works offline after first load.

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
  │ Rule-based   │                      │  Detection  │
  │ Parser       │                      │  Results    │
  │ (fuzzy match)│                      │  (bboxes)   │
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

| #   | Scenario | Description                                     | Result    |
| --- | -------- | ----------------------------------------------- | --------- |
| 1   | Match    | All pills in tray match the prescription        | ✅ PASS   |
| 2   | Missing  | Prescription requires a pill not found in tray  | ❌ FAIL   |
| 3   | Extra    | Tray contains a pill not listed in prescription | ❌ FAIL   |
| 4   | Wrong    | Tray contains a different pill than prescribed  | ❌ FAIL   |
| 5   | Unclear  | Image is blurry or poorly lit — cannot verify   | ⚠️ RETAKE |

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

| Layer              | Technology                                               |
| ------------------ | -------------------------------------------------------- |
| Pill detection     | YOLO12s (ONNX Runtime Web, WASM backend)                 |
| Prescription OCR   | PP-OCRv5 detection + Tesseract.js Vietnamese recognition |
| Drug name matching | Levenshtein fuzzy matching against 108 drug classes      |
| Framework          | Next.js 16 (App Router, Turbopack)                       |
| Deployment         | Cloudflare Pages (via OpenNext)                          |
| Inference          | 100% on-device — no data leaves the browser              |

## Project Structure

```
dose/
├── app/                        # Next.js pages
│   ├── page.tsx                # Home
│   ├── plan/[id]/              # Plan management + OCR
│   └── verification/[id]/      # Pill tray verification flow
│       └── report/             # Evidence card results
├── lib/
│   ├── ocr.ts                  # Hybrid OCR engine (PP-OCR + Tesseract)
│   ├── yolo.ts                 # YOLO ONNX inference + NMS
│   ├── verify.ts               # Fuzzy matching + verification logic
│   ├── parser.ts               # Rule-based prescription parser
│   └── storage.ts              # localStorage CRUD
├── public/
│   ├── models/                 # ONNX models (YOLO + PP-OCRv5)
│   ├── demo/                   # Test images for demo scenarios
│   └── *.wasm                  # ONNX Runtime WASM binaries
└── components/                 # UI components
```

## License

MIT
