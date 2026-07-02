"""
End-to-end pipeline tests for DOSE pill tray verification.

Tests the full flow: OCR text → parser → plan → session filter → grouped result.
Uses real catalog data (class_names.json, drug_groups.json) and scenarios from scenarios.json.
"""
import json
import re
from pathlib import Path

import pytest

from tests.catalog import loadCatalog, findDrug, getClassName, stripDosage, cleanForLookup
from tests.parser import parse_prescription

DEMO_DIR = Path(__file__).resolve().parent.parent / "demo"
SCENARIOS = json.loads((DEMO_DIR / "scenarios.json").read_text())

@pytest.fixture(autouse=True)
def _load_catalog():
    loadCatalog()

# ─── Catalog unit tests ─────────────────────────────────────────────

class TestStripDosage:
    @pytest.mark.parametrize("input_text,expected", [
        ("PARACETAMOL 500MG", "PARACETAMOL"),
        ("EBITAC 12.5 10mg + 12,5mg", "EBITAC 12.5  +"),
        ("FABAMOX 500MG 500mg", "FABAMOX"),
        ("RENAPRIL 5MG 5mg", "RENAPRIL"),
        ("NOVOXIM-500 0,5g", "NOVOXIM-500"),
        ("no dosage", "no dosage"),
    ])
    def test_strip(self, input_text, expected):
        assert stripDosage(input_text) == expected


class TestCleanForLookup:
    @pytest.mark.parametrize("input_text,expected", [
        ("PARACETAMOL", "paracetamol"),
        ("paracetamol 500mg", "paracetamol 500mg"),
        ("NOVOXIM-500", "novoxim 500"),
        ("HOẠT HUYẾT DƯỠNG NÃO", "hoạt huyết dưỡng não"),
        ("Ebitac 12.5", "ebitac 12 5"),
    ])
    def test_clean(self, input_text, expected):
        assert cleanForLookup(input_text) == expected


class TestFindDrug:
    @pytest.mark.parametrize("text,expected_ids,expected_name", [
        ("PARACETAMOL 500MG", [0], "paracetamol"),
        ("RENAPRIL 5MG", [47], "renapril"),
        ("ENALAPRIL", [46], "enalapril"),
        ("FABAMOX", [49], "fabamox"),
        ("METRONIDAZOL", [51], "metronidazol"),
        ("CHORLATCYN", [35, 97], "chorlatcyn"),
        ("NOVOXIM-500", [10, 82], "novoxim 500"),
        ("HOẠT HUYẾT DƯỠNG NÃO", [64], "hoạt huyết dưỡng não bdf"),
        ("AMOXICILIN", None, None),  # catalog has "amoxycilin" (y), OCR says "AMOXICILIN" (i) — real mismatch
        ("CLORPHENIRAMIN", [29], "clorpheniramin"),
        ("MENISON", [73, 74], "menison"),
        ("EBITAC", [45], "ebitac"),
        ("ATORIS", [13], "atoris"),
        ("GLUCOFAST", [53, 54, 55, 57], "glucofast"),
        ("DIAMICRON", None, None),
    ])
    def test_match(self, text, expected_ids, expected_name):
        result = findDrug(text)
        if expected_ids is None:
            assert result is None
        else:
            assert result is not None
            assert result["classIds"] == expected_ids
            assert result["matchedName"] == expected_name


class TestGetClassName:
    def test_known_class(self):
        assert "paracetamol" in getClassName(0).lower()

    def test_unknown_class(self):
        assert getClassName(999) == "class_999"

# ─── Parser tests ───────────────────────────────────────────────────

class TestParser:
    def test_single_drug_with_session(self):
        lines = [
            "1) PARACETAMOL 500MG 500mg",
            "SL: 10 Viên",
            "Ghi chú Uống: Sáng 1 Viên, Tối 1 Viên",
        ]
        meds = parse_prescription(lines, findDrugFn=findDrug)
        assert len(meds) == 1
        assert meds[0]["classId"] == 0
        assert len(meds[0]["doses"]) == 2
        sessions = {d["session"] for d in meds[0]["doses"]}
        assert sessions == {"morning", "evening"}

    def test_multi_drug(self):
        lines = [
            "1) FABAMOX 500MG 500mg",
            "SL: 20 viên Tối 2 viên Sáng 2 viên",
            "2) METRONIDAZOL 250 250mg",
            "SL: 20 Viên Tối 2 Viên Sáng 2 Viên",
        ]
        meds = parse_prescription(lines, findDrugFn=findDrug)
        assert len(meds) == 2
        assert meds[0]["classId"] == 49
        assert meds[1]["classId"] == 51

    def test_unknown_drug(self):
        lines = [
            "1) DIAMICRON MR 30MG",
            "SL: 30 Viên",
            "Ghi chú Uống: Sáng 1 Viên",
        ]
        meds = parse_prescription(lines, findDrugFn=findDrug)
        assert len(meds) == 1
        assert meds[0]["classId"] is None

    def test_meal_timing_before(self):
        lines = [
            "1) ENALAPRIL 5mg",
            "SL: 30 Viên",
            "Ghi chú Uống trước ăn: Sáng 1 Viên",
        ]
        meds = parse_prescription(lines, findDrugFn=findDrug)
        assert meds[0]["mealTiming"] == "before"

    def test_meal_timing_after(self):
        lines = [
            "1) GLUCOFAST 850 850mg",
            "SL: 60 Viên",
            "Ghi chú Uống sau khi ăn: Sáng 1 Viên",
        ]
        meds = parse_prescription(lines, findDrugFn=findDrug)
        assert meds[0]["mealTiming"] == "after"

    def test_no_session_keyword(self):
        lines = [
            "1) NOVOXIM-500 0,5g",
            "SL: 20 Viên",
            "Ghi chú Uống:",
        ]
        meds = parse_prescription(lines, findDrugFn=findDrug)
        assert len(meds) == 1
        assert meds[0]["doses"] == []

    def test_real_scenario_respiratory(self):
        text = SCENARIOS[0]["ocr_text"]
        # OCR text is single-line; split by entry markers "1) ", "2) ", etc.
        lines = [part.strip() for part in re.split(r"(?=\d+[\).:])\s*", text) if part.strip()]
        meds = parse_prescription(lines, findDrugFn=findDrug)
        assert len(meds) == 3
        ids = {m["classId"] for m in meds}
        assert ids == {49, 51, 35}  # chorlatcyn classIds[0] = 35

    def test_real_scenario_diabetes(self):
        text = SCENARIOS[3]["ocr_text"]
        lines = [part.strip() for part in re.split(r"(?=\d+[\).:])\s*", text) if part.strip()]
        meds = parse_prescription(lines, findDrugFn=findDrug)
        assert len(meds) == 3
        unknown = [m for m in meds if m["classId"] is None]
        assert len(unknown) == 1
        assert "DIAMICRON" in unknown[0]["name"].upper()


# ─── Session filtering tests ────────────────────────────────────────

def session_filter(med: dict, session: str, meal_timing=None) -> int:
    """Reimplementation of the session filter from report/page.tsx."""
    if len(med["doses"]) == 0:
        return 0

    filtered = []
    for d in med["doses"]:
        if d["session"] != session:
            continue
        if meal_timing and med.get("mealTiming") and med["mealTiming"] != meal_timing:
            continue
        filtered.append(d)

    return sum(d["pillCount"] for d in filtered)


class TestSessionFilter:
    def test_morning_filter(self):
        med = {"doses": [{"session": "morning", "pillCount": 2}, {"session": "evening", "pillCount": 2}], "mealTiming": None}
        assert session_filter(med, "morning") == 2

    def test_evening_filter(self):
        med = {"doses": [{"session": "morning", "pillCount": 2}, {"session": "evening", "pillCount": 2}], "mealTiming": None}
        assert session_filter(med, "evening") == 2

    def test_no_matching_session(self):
        med = {"doses": [{"session": "morning", "pillCount": 1}], "mealTiming": None}
        assert session_filter(med, "evening") == 0

    def test_meal_timing_excludes(self):
        med = {"doses": [{"session": "morning", "pillCount": 1}], "mealTiming": "before"}
        assert session_filter(med, "morning", meal_timing="after") == 0

    def test_meal_timing_includes(self):
        med = {"doses": [{"session": "morning", "pillCount": 1}], "mealTiming": "before"}
        assert session_filter(med, "morning", meal_timing="before") == 1

    def test_no_session_meds_skipped(self):
        med = {"doses": [], "mealTiming": None}
        assert session_filter(med, "morning") == 0

# ─── End-to-end scenario tests ──────────────────────────────────────

def drug_class_ids(med: dict) -> list[int]:
    match = findDrug(med["name"])
    if match:
        return match["classIds"]

    class_id = med.get("classId")
    return [] if class_id is None else [class_id]


def add_expected_group(
    groups: dict[tuple[int, ...], dict],
    med: dict,
    class_ids: list[int],
    expected: int,
) -> None:
    key = tuple(class_ids)
    if key not in groups:
        groups[key] = {
            "classIds": class_ids,
            "classId": med.get("classId") or class_ids[0],
            "expected": 0,
        }
    groups[key]["expected"] += expected


def detection_summary(detections: list[dict]) -> dict[int, dict]:
    detected = {}
    for detection in detections:
        class_id = detection["classId"]
        confidence = detection["confidence"]
        if class_id in detected:
            detected[class_id]["count"] += 1
            detected[class_id]["confidence"] = max(
                detected[class_id]["confidence"],
                confidence,
            )
            continue
        detected[class_id] = {"count": 1, "confidence": confidence}
    return detected


def grouped_status(expected: int, detected: int, confidence: float) -> str:
    if detected > 0 and confidence < 0.65:
        return "unclear"
    if detected < expected:
        return "missing"
    if detected > expected:
        return "extra"
    return "correct"


def compare_grouped_pills(groups: dict[tuple[int, ...], dict], detections: list[dict]) -> list[dict]:
    detected = detection_summary(detections)
    results = []

    for group in groups.values():
        detected_count = sum(
            detected.get(class_id, {}).get("count", 0)
            for class_id in group["classIds"]
        )
        confidence = max(
            [detected.get(class_id, {}).get("confidence", 0) for class_id in group["classIds"]],
            default=0,
        )

        for class_id in group["classIds"]:
            detected.pop(class_id, None)

        results.append({
            "classId": group["classId"],
            "name": getClassName(group["classId"]),
            "expected": group["expected"],
            "detected": detected_count,
            "confidence": confidence,
            "status": grouped_status(group["expected"], detected_count, confidence),
        })

    for class_id, detection in detected.items():
        results.append({
            "classId": class_id,
            "name": getClassName(class_id),
            "expected": 0,
            "detected": detection["count"],
            "confidence": detection["confidence"],
            "status": "extra",
        })

    return results


def analyze_scenario(scenario: dict) -> dict:
    """
    Full pipeline: scenario → plan → session filter → grouped pill result.
    Returns {results, unknown, overall}.
    """
    plan = scenario["plan"]
    session = scenario["tray_session"]
    meal_timing = scenario.get("meal_timing")
    detections = scenario["detections"]

    expected_groups = {}
    unknown_meds = []

    for med in plan["medications"]:
        total = session_filter(med, session, meal_timing)
        if total == 0:
            continue

        class_ids = drug_class_ids(med)

        if len(class_ids) > 0:
            add_expected_group(expected_groups, med, class_ids, total)
            continue

        unknown_meds.append({
            "name": med["name"],
            "classId": None,
            "expected": total,
            "detected": 0,
        })

    results = compare_grouped_pills(expected_groups, detections)

    failed = any(r["status"] in {"missing", "extra", "unclear"} for r in results)
    if failed:
        overall = "fail"
    elif len(unknown_meds) > 0:
        overall = "manual_check"
    elif len(results) == 0:
        overall = "fail"
    else:
        overall = "pass"

    return {
        "results": results,
        "unknown": unknown_meds,
        "overall": overall,
    }


class TestScenarios:
    @pytest.mark.parametrize("scenario", SCENARIOS, ids=lambda s: s["id"])
    def test_expected_overall_matches(self, scenario):
        """Each scenario's expected_overall should match what the pipeline produces."""
        output = analyze_scenario(scenario)
        assert output["overall"] == scenario["expected_overall"], (
            f"Scenario '{scenario['id']}': expected {scenario['expected_overall']}, "
            f"got {output['overall']}. Results: {output['results']}"
        )

    @pytest.mark.parametrize("scenario", SCENARIOS, ids=lambda s: s["id"])
    def test_expected_results_match(self, scenario):
        """Per-medication expected/detected counts should match."""
        output = analyze_scenario(scenario)
        expected_by_class = {r["classId"]: r for r in scenario["expected_results"]}

        for r in output["results"]:
            cid = r["classId"]
            if cid in expected_by_class:
                exp = expected_by_class[cid]
                assert r["expected"] == exp["expected"], (
                    f"Scenario '{scenario['id']}': class {cid} expected {exp['expected']}, got {r['expected']}"
                )
                assert r["detected"] == exp["detected"], (
                    f"Scenario '{scenario['id']}': class {cid} detected {exp['detected']}, got {r['detected']}"
                )
                assert r["status"] == exp["status"], (
                    f"Scenario '{scenario['id']}': class {cid} status {exp['status']}, got {r['status']}"
                )


class TestScenarioDetails:
    def test_respiratory_morning_5_pills(self):
        """Respiratory morning tray: 5 pills expected (2+2+1)."""
        s = SCENARIOS[0]
        output = analyze_scenario(s)
        total_expected = sum(r["expected"] for r in output["results"])
        total_detected = sum(r["detected"] for r in output["results"])
        assert total_expected == 5
        assert total_detected == 5

    def test_diabetes_has_unknown(self):
        """Diabetes scenario has 1 unknown drug (DIAMICRON)."""
        s = SCENARIOS[3]
        output = analyze_scenario(s)
        assert len(output["unknown"]) == 1
        assert "DIAMICRON" in output["unknown"][0]["name"].upper()

    def test_diabetes_known_missing(self):
        """Diabetes: GLUCOFAST and ENALAPRIL both missing."""
        s = SCENARIOS[3]
        output = analyze_scenario(s)
        missing = [r for r in output["results"] if r["status"] == "missing"]
        assert len(missing) == 2

    def test_hypertension_stroke_renapril_missing(self):
        """Hypertension stroke: RENAPRIL missing, HOẠT HUYẾT correct."""
        s = SCENARIOS[4]
        output = analyze_scenario(s)
        by_class = {r["classId"]: r for r in output["results"]}
        assert by_class[47]["status"] == "missing"
        assert by_class[64]["status"] == "correct"

    def test_hypertension_lipid_only_ebitac(self):
        """Hypertension lipid: morning tray only has EBITAC, ATORIS not expected."""
        s = SCENARIOS[2]
        output = analyze_scenario(s)
        assert len(output["results"]) == 1
        assert output["results"][0]["classId"] == 45
        assert output["results"][0]["status"] == "correct"

    def test_allergy_morning_4_pills(self):
        """Allergy: morning tray = 4 pills (2+1+1)."""
        s = SCENARIOS[1]
        output = analyze_scenario(s)
        total_expected = sum(r["expected"] for r in output["results"])
        assert total_expected == 4
