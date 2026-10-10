"""내려받은 원자료(data/raw/*.json)를 사이트용 site/db.js 로 변환한다.

값이 비어 있는 성분은 0 이 아니라 null 로 남긴다(자료 없음과 0 을 구분).
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "site" / "db.js"

# 가공식품 자료는 완제품(과자·도시락 등)이 대부분이라, 다른 식품의 원료로 쓰이는 분류만 싣는다
PROCESSED_AS_INGREDIENT = {
    "식용유지류", "유가공품류", "당류", "장류", "조미식품", "잼류", "농산가공식품류",
    "코코아가공품류 또는 초콜릿류", "두부류 또는 묵류", "알가공품류", "벌꿀 및 화분가공 식품류",
}

# site/calc.js 의 키 → 원자료 컬럼
FIELDS = [
    ("sodium", "NAT"),
    ("carbs", "CHOCDF"),
    ("sugar", "SUGAR"),
    ("fat", "FATCE"),
    ("transFat", "FATRN"),
    ("satFat", "FASAT"),
    ("chol", "CHOLE"),
    ("protein", "PROT"),
]


def number(text):
    text = (text or "").strip()
    if text == "":
        return None
    try:
        value = float(text)
    except ValueError:
        return None
    return int(value) if value == int(value) else round(value, 3)


def load(pk):
    path = RAW / f"{pk}.json"
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))["rows"]


rows = []
seen = set()
base_date = ""
for pk, kind in (("15100065", "원재료"), ("15100066", "가공식품")):
    for r in load(pk):
        if r.get("NUT_CON_SRTR_QUA") not in ("100g", "100ml"):
            continue
        if kind == "가공식품" and r.get("FOOD_LV3_NM") not in PROCESSED_AS_INGREDIENT:
            continue
        name = r["FOOD_NM"].replace("_", " ").strip()
        values = [number(r.get(col)) for _, col in FIELDS]
        key = (name, tuple(values))
        if key in seen:
            continue
        seen.add(key)
        base_date = max(base_date, r.get("CRTR_YMD") or "")
        rows.append([name, r.get("FOOD_LV3_NM") or kind, 1 if r["NUT_CON_SRTR_QUA"] == "100ml" else 0, *values])

rows.sort(key=lambda row: (len(row[0]), row[0]))
payload = {
    "fields": [k for k, _ in FIELDS],
    "baseDate": base_date,
    "source": "식품의약품안전처 전국통합식품영양성분정보 표준데이터 (공공데이터포털)",
    "rows": rows,
}
OUT.write_text("window.NUTRI_DB = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
print(f"{len(rows)} rows, {OUT.stat().st_size / 1024:.0f} KB, 기준일 {base_date}")
