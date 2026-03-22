/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const src = path.join(__dirname, '..', 'PERSONNEL HISTORY STATEMENT.docx');
const zip = new PizZip(fs.readFileSync(src));
const xml = zip.file('word/document.xml').asText();

// Empty paragraph in table cell: p with only pPr, no w:r
const emptyCell = /<w:tc[^>]*>([\s\S]*?)<\/w:tc>/g;
let n = 0;
let m;
while ((m = emptyCell.exec(xml)) && n < 40) {
  const inner = m[1];
  if (/<w:t>/.test(inner)) continue;
  if (!/<w:p[^>]*>[\s\S]*<\/w:p>/.test(inner)) continue;
  const label = inner.match(/textId="([^"]+)"/);
  const hasRun = /<w:r[ >]/.test(inner);
  if (hasRun) continue;
  console.log(n++, label ? label[1] : '?', inner.slice(0, 200).replace(/\s+/g, ' '));
}
