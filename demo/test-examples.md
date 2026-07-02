# Test Examples — Session-Aware Verification

Each example tests the full pipeline: **OCR text → parser → plan → session filter → comparePills → result**.

The verification engine filters by `getCurrentSession()`. A pilltray photo contains pills for **one session only**.

---

## Example 1: Morning tray — 3 drugs, all correct (PASS)

**OCR text:**
```
1) FABAMOX 500MG 500mg
SL: 20 viên Tối 2 viên Sáng 2 viên
2) METRONIDAZOL 250 250mg
SL: 20 Viên Tối 2 Viên Sáng 2 Viên
3) CHORLATCYN 125mg+50mg+50mg+25mg
Chiều 1 Viên Tối 1 Viên Sáng 1 Viên
```

**Parser extracts:**
- FABAMOX → classId: **49**, doses: morning=2, evening=2
- METRONIDAZOL → classId: **51**, doses: morning=2, evening=2
- CHORLATCYN → classId: **97**, doses: morning=1, afternoon=1, evening=1

**Tray session:** morning

**Expected for morning:**
- FABAMOX: 2 viên
- METRONIDAZOL: 2 viên
- CHORLATCYN: 1 viên
- **Total: 5 viên**

**Tray contains:** FABAMOX×2, METRONIDAZOL×2, CHORLATCYN×1

**comparePills result:**
- classId 49: expected=2, detected=2 → **correct** ✓
- classId 51: expected=2, detected=2 → **correct** ✓
- classId 97: expected=1, detected=1 → **correct** ✓

**Overall: PASS**

---

## Example 2: Morning tray — 3 drugs, all correct (PASS)

**OCR text:**
```
1) AMOXICILIN 500MG 500mg
SL: 20 viên Tối 2 viên Sáng 2 viên
2) CLORPHENIRAMIN 4mg
SL: 10 Viên Tối 1 Viên Sáng 1 Viên
3) MENISON 4mg
SL: 5 Viên Sáng 1 Viên
```

**Parser extracts:**
- AMOXICILIN → classId: **9**, doses: morning=2, evening=2
- CLORPHENIRAMIN → classId: **29**, doses: morning=1, evening=1
- MENISON → classId: **74**, doses: morning=1

**Tray session:** morning

**Expected for morning:**
- AMOXICILIN: 2 viên
- CLORPHENIRAMIN: 1 viên
- MENISON: 1 viên
- **Total: 4 viên**

**Tray contains:** AMOXICILIN×2, CLORPHENIRAMIN×1, MENISON×1

**comparePills result:**
- classId 9: expected=2, detected=2 → **correct** ✓
- classId 29: expected=1, detected=1 → **correct** ✓
- classId 74: expected=1, detected=1 → **correct** ✓

**Overall: PASS**

---

## Example 3: Morning tray — 2 drugs, ATORIS not expected (PASS)

**OCR text:**
```
1) Enalapril thydrochlorothiazide (Ebitac 12.5) 10mg + 12,5mg
Uống: Sáng 1 Viên Chiều 1 Viên SL: 60 Viên
2) Atorvastatin (Atoris 20mg) 20mg
Uống: Tối 1/2 Viên SL: 15 Viên
```

**Parser extracts:**
- EBITAC → classId: **45**, doses: morning=1, afternoon=1
- ATORIS → classId: **13**, doses: evening=1

**Tray session:** morning

**Expected for morning:**
- EBITAC: 1 viên
- ATORIS: 0 (evening only — not expected)
- **Total: 1 viên**

**Tray contains:** EBITAC×1

**comparePills result:**
- classId 45: expected=1, detected=1 → **correct** ✓
- (ATORIS classId 13 not in expected map — not checked)

**Overall: PASS**

---

## Example 4: Morning tray — 2 known missing + 1 unknown (FAIL)

**OCR text:**
```
1) GLUCOFAST 850 850mg
SL: 60 Viên Ghi chú Uống sau khi ăn: Chiều 1 Viên Sáng 1 Viên
2) DIAMICRON MR TAB 30MG 60'S 30mg
SL: 30 Viên Ghi chú Uống trước khi ăn: Sáng 1 Viên
3) ENALAPRIL 5mg
SL: 30 Viên Ghi chú Uống trước khi ăn: Sáng 1 Viên
```

**Parser extracts:**
- GLUCOFAST 850 → classId: **55**, doses: morning=1, afternoon=1
- DIAMICRON MR TAB → classId: **null** (unknown), doses: morning=1
- ENALAPRIL → classId: **46**, doses: morning=1

**Tray session:** morning

**Expected for morning:**
- GLUCOFAST: 1 viên
- DIAMICRON: 1 viên (unknown → warning box)
- ENALAPRIL: 1 viên

**Tray contains:** EMPTY (no pills detected)

**comparePills result:**
- classId 55: expected=1, detected=0 → **missing** ✗
- classId 46: expected=1, detected=0 → **missing** ✗

**Unknown drugs:**
- DIAMICRON MR TAB: expected=1, detected=0 → warning box

**Overall: FAIL** (2 missing + 1 unknown)

---

## Example 5: Morning tray — RENAPRIL missing (FAIL)

**OCR text:**
```
1) RENAPRIL 5MG 5mg
SL: 28 Viên Ghi chú Uống: Sáng 1 Viên
2) NOVOXIM-500 0,5g
SL: 20 Viên Ghi chú Uống:
3) HOẠT HUYẾT DƯỠNG NÃO 150mg+20mg
SL: 20 Viên Ghi chú Uống: Tối 2 Viên Sáng 2 Viên
```

**Parser extracts:**
- RENAPRIL → classId: **47**, doses: morning=1
- NOVOXIM-500 → classId: **10**, doses: [] (identity check only)
- HOẠT HUYẾT DƯỠNG NÃO → classId: **64**, doses: morning=2, evening=2

**Tray session:** morning

**Expected for morning:**
- RENAPRIL: 1 viên
- NOVOXIM: identity check (present if detected)
- HOẠT HUYẾT: 2 viên
- **Total: 3 viên (known)**

**Tray contains:** NOVOXIM×1, HOẠT HUYẾT×2 (RENAPRIL missing)

**comparePills result:**
- classId 47: expected=1, detected=0 → **missing** ✗
- classId 64: expected=2, detected=2 → **correct** ✓

**Identity check:**
- NOVOXIM-500: detected → present ✓

**Overall: FAIL** (1 missing: RENAPRIL)

---

## Edge Cases

### Empty tray
All expected → missing. Normal FAIL.

### Pill confidence < 0.65
Status: **unclear**. Message: "Vui lòng chụp lại".

### Drug not in YOLO model (classId: null)
Red warning box. "Thuốc chưa có trong model — kiểm tra thủ công".

### Pill in tray but wrong session
Status: **extra** — detected but unexpected for current session.

### Meal timing filter
If drug says "trước ăn" and user selects "sau ăn" filter → drug excluded from expected.
