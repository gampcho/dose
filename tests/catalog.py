"""
Python reimplementation of lib/catalog.ts algorithms.
Loaded once from the real JSON data files.
"""
import json
import re
from pathlib import Path
from typing import Optional

MODELS_DIR = Path(__file__).resolve().parent.parent / "public" / "models"

classNames: dict[int, str] = {}
drugToIds: dict[str, list[int]] = {}

_loaded = False


def loadCatalog() -> None:
    global _loaded, classNames, drugToIds
    if _loaded:
        return
    with open(MODELS_DIR / "class_names.json") as f:
        cn = json.load(f)
    with open(MODELS_DIR / "drug_groups.json") as f:
        dg = json.load(f)

    classNames = {int(k): v for k, v in cn.items()}
    drugToIds = {}
    for key, ids in dg.items():
        drugToIds[cleanForLookup(key)] = ids
    _loaded = True


def stripDosage(text: str) -> str:
    return re.sub(r"\d+(?:[,.]?\d*)\s*(?:mg|g|ml|mcg|ui)\b", "", text, flags=re.IGNORECASE).strip()


def cleanForLookup(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[,.\-;:!?/@#$%^&*+=|\\~`'\"()\[\]{}]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def findDrug(text: str) -> Optional[dict]:
    if not drugToIds:
        return None

    withoutDosage = stripDosage(text)
    cleaned = cleanForLookup(withoutDosage)

    if not cleaned or len(cleaned) < 2:
        return None

    # Exact match
    if cleaned in drugToIds:
        return {"classIds": drugToIds[cleaned], "matchedName": cleaned}

    # Contains match
    for key, ids in drugToIds.items():
        if key in cleaned or cleaned in key:
            return {"classIds": ids, "matchedName": key}

    return None


def getClassName(classId: int) -> str:
    return classNames.get(classId, f"class_{classId}")
