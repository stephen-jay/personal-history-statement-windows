/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const xml = new PizZip(fs.readFileSync(path.join(__dirname, '..', 'PERSONNEL HISTORY STATEMENT.docx')))
  .file('word/document.xml')
  .asText();

const counts = {};
const re = /w14:textId="([A-F0-9]+)"/g;
let m;
while ((m = re.exec(xml))) {
  const id = m[1];
  counts[id] = (counts[id] || 0) + 1;
}

const unique = Object.keys(counts).filter((id) => counts[id] === 1);
console.log('unique count', unique.length);

// For each unique id, extract paragraph snippet: is it empty or space only?
unique.sort();
unique.forEach((id) => {
  const idx = xml.indexOf(`w14:textId="${id}"`);
  const slice = xml.slice(idx, idx + 1200);
  const inner = slice.match(/<w:p[^>]*w14:textId="${id}"[^>]*>([\s\S]*?)<\/w:p>/);
  if (!inner) {
    console.log(id, 'NO P MATCH');
    return;
  }
  const body = inner[1];
  const text = (body.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join('');
  const plain = text.replace(/&amp;/g, '&').trim();
  const kind = !plain ? 'EMPTY' : plain.length < 3 ? `SPACE[${plain}]` : `TEXT:${plain.slice(0, 40)}`;
  console.log(id, kind);
});
