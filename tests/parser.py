"""
Python reimplementation of lib/parser.ts algorithms.
State machine parser for Vietnamese prescription OCR text.
"""
import re
from typing import Optional

SESSION_MAP = {
    "sáng": "morning",
    "trưa": "noon",
    "chiều": "afternoon",
    "tối": "evening",
}

QUANTITY_PATTERN = re.compile(r"(?:Số lượng|SL|Qty)[:\s]*(\d+)", re.IGNORECASE)
DOSAGE_PATTERN = re.compile(r"\b(\d+(?:[.,]\d+)?)\s*(mg|g|ml|mcg|ui)\b", re.IGNORECASE)
DOSAGE_FULL = re.compile(r"\d+(?:[.,]\d+)?\s*(?:mg|g|ml|mcg|ui)", re.IGNORECASE)
NEW_ENTRY = re.compile(r"^\d+[\).:\-]") or re.compile(r"^[-•]\s") or re.compile(r"^thuốc[:\s]", re.IGNORECASE)
INSTRUCTIONS = re.compile(r"ghi\s*chú|lời\s*dặn|cộng\s*khoản", re.IGNORECASE)
BEFORE_EAT = re.compile(r"trước\s*ăn|trc\s*ăn", re.IGNORECASE)
AFTER_EAT = re.compile(r"sau\s*(?:khi\s*)?ăn|sau\s*ăn", re.IGNORECASE)


def blank_med() -> dict:
    return {
        "name": "",
        "classId": None,
        "matchedName": None,
        "quantity": 0,
        "dosage": "",
        "doses": [],
        "mealTiming": None,
    }


def parse_drug_line(line: str) -> dict:
    cleaned = re.sub(r"^\d+[\).:\-]\s*", "", line)
    cleaned = re.sub(r"^[-•]\s*", "", cleaned)
    cleaned = re.sub(r"^thuốc[:\s]*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    name = cleaned
    quantity = 0
    dosage = ""

    qm = QUANTITY_PATTERN.search(cleaned)
    if qm:
        quantity = int(qm.group(1))
        name = name.replace(qm.group(0), "").strip()

    dm = DOSAGE_PATTERN.search(cleaned)
    if dm:
        dosage = f"{dm.group(1)}{dm.group(2)}"

    parts = DOSAGE_FULL.split(name)
    name = parts[0].strip()

    if len(name) < 2 and len(cleaned) > len(name):
        name = DOSAGE_FULL.sub("", cleaned)
        name = re.sub(r"&L.*$", "", name, flags=re.IGNORECASE)
        name = re.sub(r"\s+", " ", name).strip()

    med = blank_med()
    med["name"] = name
    med["quantity"] = quantity
    med["dosage"] = dosage
    return med


def parse_session_pills(line: str) -> list[dict]:
    results = []
    for kw, session in SESSION_MAP.items():
        pattern = re.compile(rf"{kw}\s*(\d+)\s*viên", re.IGNORECASE)
        m = pattern.search(line)
        if m:
            results.append({"session": session, "pillCount": int(m.group(1))})
    return results


def parse_prescription(lines: list[str], findDrugFn=None) -> list[dict]:
    """
    Parse OCR text lines into list of ParsedMed dicts.
    findDrugFn: optional function(text) -> {"classIds": [...], "matchedName": ...} | None
    """
    meds = []
    current = None

    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            continue

        is_new = (
            bool(re.match(r"^\d+[\).:\-]", line))
            or bool(re.match(r"^[-•]\s", line))
            or bool(re.match(r"^thuốc[:\s]", line, re.IGNORECASE))
        )

        if is_new:
            if current is not None:
                meds.append(current)
            current = parse_drug_line(line)
            continue

        if current is None:
            continue

        if INSTRUCTIONS.search(line):
            current["doses"] = parse_session_pills(line)

        for kw, session in SESSION_MAP.items():
            if kw in line.lower():
                if len(current["doses"]) == 0:
                    current["doses"].append({"session": session, "pillCount": 1})

        if BEFORE_EAT.search(line):
            current["mealTiming"] = "before"
        elif AFTER_EAT.search(line):
            current["mealTiming"] = "after"

        qm = QUANTITY_PATTERN.search(line)
        if qm:
            current["quantity"] = int(qm.group(1))

        dm = DOSAGE_PATTERN.search(line)
        if dm and not current["dosage"]:
            current["dosage"] = f"{dm.group(1)}{dm.group(2)}"

    if current is not None:
        meds.append(current)

    if findDrugFn:
        for med in meds:
            if not med["name"]:
                continue
            match = findDrugFn(med["name"])
            if match:
                med["classId"] = match["classIds"][0]
                med["matchedName"] = match["matchedName"]

    return [m for m in meds if len(m["name"]) > 0]
