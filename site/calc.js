/*
 * 영양성분 계산·표시 규칙.
 * 근거: 식품의약품안전처 「한눈에 보는 영양표시 가이드라인(민원인 안내서)」(2024.12),
 *       「식품등의 표시기준」 별지1 1.아. 영양성분별 세부표시방법,
 *       「식품 등의 표시·광고에 관한 법률 시행규칙」 별표5 1일 영양성분 기준치.
 */
(function (root) {
  'use strict';

  // 영양성분표 도안의 표시 순서
  const NUTRIENTS = [
    { key: 'sodium', name: '나트륨', unit: 'mg', dv: 2000 },
    { key: 'carbs', name: '탄수화물', unit: 'g', dv: 324 },
    { key: 'sugar', name: '당류', unit: 'g', dv: 100, indent: true },
    { key: 'fat', name: '지방', unit: 'g', dv: 54 },
    { key: 'transFat', name: '트랜스지방', unit: 'g', dv: null, indent: true },
    { key: 'satFat', name: '포화지방', unit: 'g', dv: 15, indent: true },
    { key: 'chol', name: '콜레스테롤', unit: 'mg', dv: 300 },
    { key: 'protein', name: '단백질', unit: 'g', dv: 55 },
  ];
  const KEYS = NUTRIENTS.map((n) => n.key);

  function roundTo(value, step) {
    // 부동소수 오차(예: 0.15)를 피하려고 정수 배율로 계산한다
    const scaled = Math.round((value / step) * 1e6) / 1e6;
    return Math.round(scaled) * step;
  }

  function trim(value, digits) {
    return Number(value.toFixed(digits));
  }

  /**
   * 실제 값 → 표시값. 반환: { text, value, lessThan }
   * value 는 % 기준치 계산에 쓰는 값("○ 미만" 표시는 실제 값).
   */
  function displayAmount(key, raw) {
    const v = Math.max(0, raw);
    switch (key) {
      case 'sodium': {
        if (v < 5) return { text: '0mg', value: 0 };
        const r = v <= 120 ? roundTo(v, 5) : roundTo(v, 10);
        return { text: formatNumber(r) + 'mg', value: r };
      }
      case 'carbs':
      case 'sugar':
      case 'protein': {
        if (v < 0.5) return { text: '0g', value: 0 };
        if (v < 1) return { text: '1g 미만', value: v, lessThan: true };
        const r = Math.round(v);
        return { text: formatNumber(r) + 'g', value: r };
      }
      case 'fat':
      case 'satFat': {
        if (v < 0.5) return { text: '0g', value: 0 };
        const r = v <= 5 ? trim(roundTo(v, 0.1), 1) : Math.round(v);
        return { text: formatNumber(r) + 'g', value: r };
      }
      case 'transFat': {
        if (v < 0.2) return { text: '0g', value: 0 };
        if (v < 0.5) return { text: '0.5g 미만', value: v, lessThan: true };
        const r = v <= 5 ? trim(roundTo(v, 0.1), 1) : Math.round(v);
        return { text: formatNumber(r) + 'g', value: r };
      }
      case 'chol': {
        if (v < 2) return { text: '0mg', value: 0 };
        if (v < 5) return { text: '5mg 미만', value: v, lessThan: true };
        const r = roundTo(v, 5);
        return { text: formatNumber(r) + 'mg', value: r };
      }
      default:
        throw new Error('unknown nutrient: ' + key);
    }
  }

  function formatNumber(n) {
    const [int, frac] = String(n).split('.');
    const withComma = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return frac ? withComma + '.' + frac : withComma;
  }

  // 열량은 표시된 함량으로 계산한다(탄수화물·단백질 4kcal/g, 지방 9kcal/g).
  function displayEnergy(shown) {
    const kcal = shown.carbs.value * 4 + shown.protein.value * 4 + shown.fat.value * 9;
    if (kcal < 5) return { text: '0kcal', value: 0, raw: kcal };
    const r = roundTo(kcal, 5);
    return { text: formatNumber(r) + 'kcal', value: r, raw: kcal };
  }

  /**
   * 배합표 합산.
   * items: [{ name, grams, per100: {sodium, carbs, ...} }] — per100 값이 null 이면 자료 없음.
   * 반환: { totals, weight, missing: { key: [재료명] } }
   */
  function sumRecipe(items) {
    const totals = {};
    const missing = {};
    KEYS.forEach((k) => {
      totals[k] = 0;
      missing[k] = [];
    });
    let weight = 0;
    for (const item of items) {
      const grams = Number(item.grams) || 0;
      if (grams <= 0) continue;
      weight += grams;
      for (const k of KEYS) {
        const per100 = item.per100[k];
        if (per100 === null || per100 === undefined || per100 === '') {
          missing[k].push(item.name);
        } else {
          totals[k] += (Number(per100) * grams) / 100;
        }
      }
    }
    return { totals, weight, missing };
  }

  /**
   * 표시 단위 분량으로 환산해 표시값을 만든다.
   * totals: 배합 전체의 영양성분 합, finalWeight: 완제품 총 중량(g), basisGrams: 표시 단위 분량(g)
   */
  function buildLabel(totals, finalWeight, basisGrams) {
    if (!(finalWeight > 0) || !(basisGrams > 0)) throw new Error('중량은 0보다 커야 합니다');
    const ratio = basisGrams / finalWeight;
    const shown = {};
    const rows = NUTRIENTS.map((n) => {
      const raw = totals[n.key] * ratio;
      const d = displayAmount(n.key, raw);
      shown[n.key] = d;
      const percent = n.dv === null ? null : Math.round((d.value / n.dv) * 100);
      return { key: n.key, name: n.name, indent: !!n.indent, raw, text: d.text, percent };
    });
    return { energy: displayEnergy(shown), rows };
  }

  const api = { NUTRIENTS, KEYS, displayAmount, displayEnergy, sumRecipe, buildLabel, formatNumber };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NutriCalc = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
