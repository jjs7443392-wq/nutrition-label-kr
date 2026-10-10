const test = require('node:test');
const assert = require('node:assert/strict');
const { displayAmount, displayEnergy, sumRecipe, buildLabel } = require('../site/calc.js');

const text = (key, v) => displayAmount(key, v).text;

test('나트륨: 5mg 미만 0, 120mg 이하 5mg 단위, 초과 10mg 단위', () => {
  assert.equal(text('sodium', 4.9), '0mg');
  assert.equal(text('sodium', 118), '120mg');
  assert.equal(text('sodium', 112), '110mg');
  assert.equal(text('sodium', 124), '120mg');
  assert.equal(text('sodium', 1796), '1,800mg');
});

test('탄수화물·당류·단백질: 1g 단위, 1g 미만, 0.5g 미만 0', () => {
  assert.equal(text('carbs', 0.4), '0g');
  assert.equal(text('carbs', 0.6), '1g 미만');
  assert.equal(text('sugar', 53.6), '54g');
  assert.equal(text('protein', 20.5), '21g');
});

test('지방·포화지방: 5g 이하 0.1g 단위, 초과 1g 단위, 0.5g 미만 0', () => {
  assert.equal(text('fat', 0.49), '0g');
  assert.equal(text('fat', 0.55), '0.6g');
  assert.equal(text('fat', 4.96), '5g');
  assert.equal(text('fat', 11.4), '11g');
  assert.equal(text('satFat', 0.62), '0.6g');
});

test('트랜스지방: 0.2g 미만 0, 0.5g 미만은 "0.5g 미만"', () => {
  assert.equal(text('transFat', 0.19), '0g');
  assert.equal(text('transFat', 0.3), '0.5g 미만');
  assert.equal(text('transFat', 0.74), '0.7g');
});

test('콜레스테롤: 2mg 미만 0, 5mg 미만은 "5mg 미만", 5mg 단위', () => {
  assert.equal(text('chol', 1.9), '0mg');
  assert.equal(text('chol', 3), '5mg 미만');
  // 가이드라인 예시: 13.5mg → 15mg
  assert.equal(text('chol', 13.5), '15mg');
});

test('가이드라인 예시: % 기준치는 표시값으로, "미만" 표시는 실제값으로 계산', () => {
  const totals = { sodium: 0, carbs: 0.6, sugar: 0, fat: 0, transFat: 0, satFat: 0, chol: 13.5, protein: 0 };
  const label = buildLabel(totals, 100, 100);
  const row = (k) => label.rows.find((r) => r.key === k);
  assert.equal(row('chol').text, '15mg');
  assert.equal(row('chol').percent, 5); // 15 ÷ 300
  assert.equal(row('carbs').text, '1g 미만');
  assert.equal(row('carbs').percent, 0); // 0.6 ÷ 324
  assert.equal(row('transFat').percent, null);
});

test('열량: 표시 함량으로 계산해 5kcal 단위', () => {
  const shown = { carbs: { value: 46 }, protein: { value: 5 }, fat: { value: 9 } };
  // 46×4 + 5×4 + 9×9 = 285
  assert.equal(displayEnergy(shown).text, '285kcal');
  assert.equal(displayEnergy({ carbs: { value: 1 }, protein: { value: 0 }, fat: { value: 0 } }).text, '0kcal');
});

test('배합표 합산과 단위 환산, 자료 없는 성분 표시', () => {
  const items = [
    { name: '밀가루', grams: 200, per100: { sodium: 1, carbs: 75, sugar: 1, fat: 1, transFat: 0, satFat: 0.2, chol: 0, protein: 10 } },
    { name: '설탕', grams: 50, per100: { sodium: 0, carbs: 100, sugar: 100, fat: 0, transFat: null, satFat: 0, chol: 0, protein: 0 } },
    { name: '빈 줄', grams: 0, per100: {} },
  ];
  const { totals, weight, missing } = sumRecipe(items);
  assert.equal(weight, 250);
  assert.equal(totals.carbs, 200);
  assert.equal(totals.sugar, 52);
  assert.deepEqual(missing.transFat, ['설탕']);
  assert.deepEqual(missing.carbs, []);

  // 굽고 나서 200g 이 된 제품을 50g 단위로 표시
  const label = buildLabel(totals, 200, 50);
  const row = (k) => label.rows.find((r) => r.key === k);
  assert.equal(row('carbs').text, '50g');
  assert.equal(row('sugar').text, '13g');
  assert.equal(row('protein').text, '5g');
  assert.equal(row('fat').text, '0.5g');
  // 50×4 + 5×4 + 0.5×9 = 224.5 → 225
  assert.equal(label.energy.text, '225kcal');
});
