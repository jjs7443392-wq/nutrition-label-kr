(function () {
  'use strict';

  const { NUTRIENTS, KEYS, sumRecipe, buildLabel, formatNumber } = window.NutriCalc;
  const { renderLabelSvg } = window.NutriLabel;
  const DB = window.NUTRI_DB;
  const STORAGE_KEY = 'nutri-label-recipe-v1';
  const MAX_SUGGEST = 40;

  const $ = (id) => document.getElementById(id);
  const itemsEl = $('items');
  const template = $('itemTemplate');

  // DB 행: [이름, 분류, ml여부, ...FIELDS 순서의 값]
  const fieldIndex = {};
  DB.fields.forEach((f, i) => (fieldIndex[f] = i + 3));
  const searchNames = DB.rows.map((r) => r[0].replace(/\s+/g, '').toLowerCase());

  let items = [];
  let currentSvg = '';

  function newItem() {
    const per100 = {};
    KEYS.forEach((k) => (per100[k] = null));
    return { name: '', grams: '', per100, category: '' };
  }

  function search(query) {
    const q = query.replace(/\s+/g, '').toLowerCase();
    if (!q) return [];
    const starts = [];
    const contains = [];
    for (let i = 0; i < searchNames.length; i++) {
      const pos = searchNames[i].indexOf(q);
      if (pos === 0) starts.push(i);
      else if (pos > 0) contains.push(i);
      if (starts.length >= MAX_SUGGEST) break;
    }
    return starts.concat(contains).slice(0, MAX_SUGGEST);
  }

  function renderItems() {
    itemsEl.textContent = '';
    items.forEach((item, index) => itemsEl.appendChild(buildItemRow(item, index)));
  }

  function buildItemRow(item, index) {
    const node = template.content.firstElementChild.cloneNode(true);
    const nameInput = node.querySelector('.name');
    const gramsInput = node.querySelector('.grams');
    const suggest = node.querySelector('.suggest');
    const valuesBox = node.querySelector('.values');
    const valuesGrid = node.querySelector('.values-grid');
    const missingEl = node.querySelector('.missing');

    nameInput.value = item.name;
    gramsInput.value = item.grams;

    const valueInputs = {};
    NUTRIENTS.forEach((n) => {
      const label = document.createElement('label');
      label.textContent = `${n.name} (${n.unit})`;
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.step = 'any';
      input.addEventListener('input', () => {
        item.per100[n.key] = input.value === '' ? null : Number(input.value);
        showMissing();
        update();
      });
      label.appendChild(input);
      valuesGrid.appendChild(label);
      valueInputs[n.key] = input;
    });

    function fillValues() {
      NUTRIENTS.forEach((n) => {
        const v = item.per100[n.key];
        valueInputs[n.key].value = v === null || v === undefined ? '' : v;
      });
    }

    function showMissing() {
      const lacking = NUTRIENTS.filter((n) => item.per100[n.key] === null || item.per100[n.key] === undefined);
      if (!item.name || lacking.length === 0) {
        missingEl.textContent = '';
      } else if (lacking.length === NUTRIENTS.length) {
        missingEl.textContent = 'DB에서 고르지 않은 원재료입니다. "성분값"을 눌러 100g당 값을 넣어 주세요.';
      } else {
        missingEl.textContent = '자료 없음: ' + lacking.map((n) => n.name).join(', ') + ' — "성분값"에서 직접 넣을 수 있습니다.';
      }
    }

    function closeSuggest() {
      suggest.hidden = true;
      suggest.textContent = '';
    }

    function choose(rowIndex) {
      const row = DB.rows[rowIndex];
      item.name = row[0];
      item.category = row[1];
      KEYS.forEach((k) => (item.per100[k] = row[fieldIndex[k]]));
      nameInput.value = item.name;
      fillValues();
      showMissing();
      closeSuggest();
      gramsInput.focus();
      update();
    }

    nameInput.addEventListener('input', () => {
      item.name = nameInput.value.trim();
      const hits = search(nameInput.value);
      suggest.textContent = '';
      hits.forEach((rowIndex) => {
        const row = DB.rows[rowIndex];
        const li = document.createElement('li');
        const name = document.createElement('span');
        name.textContent = row[0];
        const category = document.createElement('small');
        category.textContent = row[1];
        li.append(name, category);
        // blur 보다 먼저 처리되도록 mousedown 을 쓴다
        li.addEventListener('mousedown', (event) => {
          event.preventDefault();
          choose(rowIndex);
        });
        suggest.appendChild(li);
      });
      suggest.hidden = hits.length === 0;
      showMissing();
      update();
    });
    nameInput.addEventListener('blur', closeSuggest);
    nameInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && suggest.firstElementChild) {
        event.preventDefault();
        suggest.firstElementChild.dispatchEvent(new MouseEvent('mousedown'));
      } else if (event.key === 'Escape') {
        closeSuggest();
      }
    });

    gramsInput.addEventListener('input', () => {
      item.grams = gramsInput.value;
      update();
    });

    node.querySelector('.toggle').addEventListener('click', () => {
      valuesBox.hidden = !valuesBox.hidden;
    });
    node.querySelector('.remove').addEventListener('click', () => {
      items.splice(index, 1);
      if (items.length === 0) items.push(newItem());
      renderItems();
      update();
    });

    fillValues();
    showMissing();
    return node;
  }

  function readProduct() {
    return {
      productName: $('productName').value.trim(),
      packAmount: Number($('packAmount').value) || 0,
      packUnit: $('packUnit').value,
      basis: $('basis').value,
      unitCount: Number($('unitCount').value) || 0,
      finalWeight: Number($('finalWeight').value) || 0,
    };
  }

  // 표시 단위에 따른 기준 분량(g)과 도안 문구
  function basisInfo(product) {
    const unit = product.packUnit;
    const amount = formatNumber(product.packAmount);
    if (product.basis === 'per100') {
      return { grams: 100, amountText: `총 내용량 ${amount}${unit}`, basisText: `100${unit}당` };
    }
    if (product.basis === 'unit') {
      const each = product.packAmount / product.unitCount;
      const eachText = formatNumber(Math.round(each * 10) / 10);
      return {
        grams: each,
        amountText: `총 내용량 ${amount}${unit}(${eachText}${unit}×${product.unitCount}개)`,
        basisText: `1개(${eachText}${unit})당`,
      };
    }
    return { grams: product.packAmount, amountText: `총 내용량 ${amount}${unit}`, basisText: '총 내용량당' };
  }

  function update() {
    const product = readProduct();
    $('unitCountWrap').hidden = product.basis !== 'unit';

    const used = items.filter((item) => item.name && Number(item.grams) > 0);
    const { totals, weight, missing } = sumRecipe(used);
    $('mixWeight').textContent = formatNumber(Math.round(weight * 10) / 10) + ' g';
    const finalWeight = product.finalWeight || weight;

    const problems = [];
    if (used.length === 0) problems.push('원재료와 중량을 한 줄 이상 넣어 주세요.');
    if (!(product.packAmount > 0)) problems.push('1포장 내용량을 넣어 주세요.');
    if (product.basis === 'unit' && !(product.unitCount > 0)) problems.push('1포장에 든 개수를 넣어 주세요.');
    if (product.basis === 'per100' && product.packAmount > 0 && product.packAmount <= 100) {
      problems.push('100g(ml)당 표시는 총 내용량이 100g(ml)을 넘는 제품에 쓸 수 있습니다.');
    }
    if (product.finalWeight > weight && weight > 0) {
      problems.push('완성품 총 중량이 배합 합계보다 큽니다. 물처럼 빠뜨린 원재료가 없는지 확인하세요.');
    }
    NUTRIENTS.forEach((n) => {
      if (missing[n.key].length) {
        problems.push(`${n.name}: ${missing[n.key].join(', ')}의 자료가 없어 0으로 계산했습니다.`);
      }
    });
    renderWarnings(problems);

    const ready = used.length > 0 && product.packAmount > 0 && (product.basis !== 'unit' || product.unitCount > 0);
    if (!ready) {
      currentSvg = '';
      $('label').textContent = '';
      $('rawTable').textContent = '';
      $('ingredientList').textContent = '';
      save();
      return;
    }

    const info = basisInfo(product);
    const label = buildLabel(totals, finalWeight, info.grams);
    currentSvg = renderLabelSvg(label, info);
    $('label').innerHTML = currentSvg;

    $('ingredientList').textContent = used
      .slice()
      .sort((a, b) => Number(b.grams) - Number(a.grams))
      .map((item) => item.name)
      .join(', ');

    renderRawTable(label, info);
    save();
  }

  function renderWarnings(problems) {
    const box = $('warnings');
    box.textContent = '';
    if (problems.length === 0) return;
    const wrap = document.createElement('div');
    wrap.className = 'warn';
    const list = document.createElement('ul');
    problems.forEach((text) => {
      const li = document.createElement('li');
      li.textContent = text;
      list.appendChild(li);
    });
    wrap.append('확인이 필요합니다', list);
    box.appendChild(wrap);
  }

  function renderRawTable(label, info) {
    const table = $('rawTable');
    table.textContent = '';
    const head = table.insertRow();
    ['영양성분', `${info.basisText} 계산값`, '표시값'].forEach((text) => {
      const th = document.createElement('th');
      th.textContent = text;
      head.appendChild(th);
    });
    const energyRow = table.insertRow();
    energyRow.insertCell().textContent = '열량';
    energyRow.insertCell().textContent = label.energy.raw.toFixed(1) + ' kcal';
    energyRow.insertCell().textContent = label.energy.text;
    label.rows.forEach((row) => {
      const unit = NUTRIENTS.find((n) => n.key === row.key).unit;
      const tr = table.insertRow();
      tr.insertCell().textContent = row.name;
      tr.insertCell().textContent = row.raw.toFixed(2) + ' ' + unit;
      tr.insertCell().textContent = row.text;
    });
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ product: readProduct(), items }));
    } catch (err) {
      // 사생활 보호 모드 등에서는 저장하지 않는다
    }
  }

  function restore() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!saved) return;
      const p = saved.product || {};
      $('productName').value = p.productName || '';
      $('packAmount').value = p.packAmount || '';
      $('packUnit').value = p.packUnit || 'g';
      $('basis').value = p.basis || 'total';
      $('unitCount').value = p.unitCount || '';
      $('finalWeight').value = p.finalWeight || '';
      if (Array.isArray(saved.items) && saved.items.length) {
        items = saved.items.map((raw) => Object.assign(newItem(), raw, { per100: Object.assign(newItem().per100, raw.per100) }));
      }
    } catch (err) {
      // 저장된 값이 깨져 있으면 빈 상태로 시작한다
    }
  }

  function fileName(ext) {
    const name = $('productName').value.trim() || '영양정보';
    return `${name.replace(/[\\/:*?"<>|]/g, '_')}_영양정보.${ext}`;
  }

  function download(blob, name) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  $('downloadSvg').addEventListener('click', () => {
    if (!currentSvg) return;
    download(new Blob([currentSvg], { type: 'image/svg+xml;charset=utf-8' }), fileName('svg'));
  });

  $('downloadPng').addEventListener('click', () => {
    if (!currentSvg) return;
    const scale = 4; // 인쇄용으로 넉넉한 해상도
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.width * scale;
      canvas.height = image.height * scale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => download(blob, fileName('png')), 'image/png');
    };
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(currentSvg);
  });

  ['productName', 'packAmount', 'packUnit', 'basis', 'unitCount', 'finalWeight'].forEach((id) => {
    $(id).addEventListener('input', update);
  });
  $('addItem').addEventListener('click', () => {
    items.push(newItem());
    renderItems();
    itemsEl.lastElementChild.querySelector('.name').focus();
  });

  $('dbSource').textContent = DB.source;
  $('dbDate').textContent = DB.baseDate;
  $('dbCount').textContent = formatNumber(DB.rows.length);

  restore();
  if (items.length === 0) items = [newItem(), newItem(), newItem()];
  renderItems();
  update();
})();
