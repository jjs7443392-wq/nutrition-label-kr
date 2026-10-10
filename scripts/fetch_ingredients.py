"""공공데이터포털 '전국통합식품영양성분정보(원재료성식품)표준데이터'(15100065)를 내려받는다.

포털의 CSV 다운로드 버튼이 호출하는 것과 같은 공개 엔드포인트를 사용한다.
이용허락범위: 제한 없음 (출처: 식품의약품안전처, 공공데이터포털).
"""
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

PK = sys.argv[1] if len(sys.argv) > 1 else "15100065"
BASE = "https://www.data.go.kr"
OUT = Path(__file__).resolve().parent.parent / "data" / "raw" / f"{PK}.json"
HEADERS = {"User-Agent": "Mozilla/5.0", "Referer": f"{BASE}/data/{PK}/standard.do"}


def get(url, tries=4):
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=300) as res:
                return json.loads(res.read().decode("utf-8"))
        except Exception as err:  # 포털 응답이 느려 자주 끊긴다
            if attempt == tries - 1:
                raise
            print("retry", attempt + 1, err, flush=True)
            time.sleep(5)


header = get(f"{BASE}/download/columList.json?pk={PK}&ext=CSV")
columns = [(c["columCode"], c["columNm"]) for c in header["columList"]]
total = header["totalCount"]
per_page = int(sys.argv[2]) if len(sys.argv) > 2 else 10000
rows = []
for page in range(1, -(-total // per_page) + 1):
    query = urllib.parse.urlencode(
        {
            "publicDataPk": PK,
            "colNmList": header["tableVO"]["colNmList"],
            "totalCount": total,
            "svcTableNm": header["tableVO"]["svcTableNm"],
            "perPage": per_page,
            "page": page,
        },
        doseq=True,
    )
    rows.extend(get(f"{BASE}/download/standard.json?{query}"))
    print(f"page {page}: {len(rows)}/{total}", flush=True)
    time.sleep(1)

OUT.write_text(json.dumps({"columns": columns, "rows": rows}, ensure_ascii=False), encoding="utf-8")
print("saved", OUT, len(rows))
