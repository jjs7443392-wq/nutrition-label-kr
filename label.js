/*
 * 영양성분표 [기본형] 도안을 SVG 문자열로 그린다.
 * 「식품등의 표시기준」 [도 3] 기본형 구성(영양정보 / 내용량·열량 / 단위·기준치 비율 / 성분 행 / 기준 문구)을 따른다.
 */
(function (root) {
  'use strict';

  const FONT = "'Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif";
  const FOOTNOTE = ['1일 영양성분 기준치에 대한 비율(%)은 2,000kcal 기준이므로', '개인의 필요 열량에 따라 다를 수 있습니다.'];

  function escape(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /**
   * label: NutriCalc.buildLabel() 결과
   * info: { amountText: '총 내용량 420g', basisText: '총 내용량당' }
   */
  function renderLabelSvg(label, info) {
    const W = 320;
    const PAD = 12;
    const ROW = 26;
    const headH = 58;
    const subH = 40;
    const footH = 40;
    const H = PAD + headH + subH + label.rows.length * ROW + footH + PAD - 6;
    const right = W - PAD;
    const out = [];

    out.push(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">`,
      `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" fill="#fff" stroke="#000" stroke-width="2"/>`
    );

    // 머리: 영양정보 / 내용량 / 열량
    let y = PAD;
    out.push(
      `<text x="${PAD}" y="${y + 36}" font-size="30" font-weight="800">영양정보</text>`,
      `<text x="${right}" y="${y + 18}" font-size="13" text-anchor="end">${escape(info.amountText)}</text>`,
      `<text x="${right}" y="${y + 42}" font-size="20" font-weight="800" text-anchor="end">${escape(label.energy.text)}</text>`
    );
    y += headH;
    out.push(`<rect x="${PAD}" y="${y - 6}" width="${W - PAD * 2}" height="5" fill="#000"/>`);

    // 단위 / 기준치 비율 머리글
    out.push(
      `<text x="${PAD}" y="${y + 24}" font-size="13" font-weight="700">${escape(info.basisText)}</text>`,
      `<text x="${right}" y="${y + 14}" font-size="11" font-weight="700" text-anchor="end">1일 영양성분</text>`,
      `<text x="${right}" y="${y + 28}" font-size="11" font-weight="700" text-anchor="end">기준치에 대한 비율</text>`
    );
    y += subH;
    out.push(`<rect x="${PAD}" y="${y - 6}" width="${W - PAD * 2}" height="2.5" fill="#000"/>`);

    label.rows.forEach((row, i) => {
      const x = PAD + (row.indent ? 14 : 0);
      const base = y + 14;
      if (i > 0) out.push(`<line x1="${PAD}" y1="${y - 4}" x2="${right}" y2="${y - 4}" stroke="#000" stroke-width="0.7"/>`);
      out.push(
        `<text x="${x}" y="${base}" font-size="14"><tspan font-weight="${row.indent ? 400 : 700}">${escape(row.name)}</tspan> ${escape(row.text)}</text>`
      );
      if (row.percent !== null) {
        out.push(`<text x="${right}" y="${base}" font-size="14" font-weight="700" text-anchor="end">${row.percent}%</text>`);
      }
      y += ROW;
    });

    out.push(`<rect x="${PAD}" y="${y - 6}" width="${W - PAD * 2}" height="2.5" fill="#000"/>`);
    FOOTNOTE.forEach((line, i) => {
      out.push(`<text x="${PAD}" y="${y + 12 + i * 14}" font-size="9.5">${escape(line)}</text>`);
    });
    out.push('</svg>');
    return out.join('');
  }

  const api = { renderLabelSvg };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NutriLabel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
