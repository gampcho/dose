"""
End-to-end pipeline tests for DOSE pill tray verification.

Tests the full flow: OCR text → parser → plan → session filter → comparePills → result.
Uses real catalog data (class_names.json, drug_groups.json) and scenarios from scenarios.json.
"""
import json
import re
from pathlib import Path

import pytest

from tests.catalog import loadCatalog, findDrug, comparePills, getClassName, stripDosage, cleanForLookup
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


# ─── comparePills unit tests ────────────────────────────────────────

class TestComparePills:
    def test_all_correct(self):
        expected = {49: 2, 51: 2}
        detections = [
            {"classId": 49, "confidence": 0.9},
            {"classId": 49, "confidence": 0.85},
            {"classId": 51, "confidence": 0.92},
            {"classId": 51, "confidence": 0.88},
        ]
        results = comparePills(expected, detections)
        assert len(results) == 2
        assert all(r["status"] == "correct" for r in results)

    def test_missing(self):
        expected = {47: 1, 64: 2}
        detections = [{"classId": 64, "confidence": 0.9}, {"classId": 64, "confidence": 0.85}]
        results = comparePills(expected, detections)
        by_class = {r["classId"]: r for r in results}
        assert by_class[47]["status"] == "missing"
        assert by_class[47]["detected"] == 0
        assert by_class[64]["status"] == "correct"

    def test_extra(self):
        expected = {45: 1}
        detections = [{"classId": 45, "confidence": 0.9}, {"classId": 13, "confidence": 0.8}]
        results = comparePills(expected, detections)
        by_class = {r["classId"]: r for r in results}
        assert by_class[45]["status"] == "correct"  # 1 expected, 1 detected
        assert by_class[13]["status"] == "extra"  # 0 expected, 1 detected
        assert by_class[13]["expected"] == 0

    def test_unclear_low_confidence(self):
        expected = {49: 1}
        detections = [{"classId": 49, "confidence": 0.5}]
        results = comparePills(expected, detections)
        assert results[0]["status"] == "unclear"

    def test_empty_detections(self):
        expected = {49: 2, 51: 2}
        results = comparePills(expected, [])
        assert all(r["status"] == "missing" for r in results)
        assert all(r["detected"] == 0 for r in results)

    def test_empty_expected(self):
        detections = [{"classId": 99, "confidence": 0.9}]
        results = comparePills({}, detections)
        assert len(results) == 1
        assert results[0]["status"] == "extra"


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

def analyze_scenario(scenario: dict) -> dict:
    """
    Full pipeline: scenario → plan → session filter → comparePills → result.
    Returns {results, unknown, overall}.
    """
    plan = scenario["plan"]
    session = scenario["tray_session"]
    meal_timing = scenario.get("meal_timing")
    detections = scenario["detections"]

    expected_map = {}
    unknown_meds = []

    for med in plan["medications"]:
        total = session_filter(med, session, meal_timing)
        if total == 0:
            continue

        class_id = med.get("classId")
        match = findDrug(med["name"])
        all_class_ids = match["classIds"] if match else ([class_id] if class_id is not None else [])

        if len(all_class_ids) > 0:
            for cid in all_class_ids:
                expected_map[cid] = expected_map.get(cid, 0) + total
        else:
            unknown_meds.append({
                "name": med["name"],
                "classId": None,
                "expected": total,
                "detected": 0,
            })

    results = comparePills(expected_map, detections)

    missing = sum(1 for r in results if r["status"] == "missing")
    extra = sum(1 for r in results if r["status"] == "extra")
    overall = "pass" if missing == 0 and extra == 0 and len(results) > 0 else "fail"

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
