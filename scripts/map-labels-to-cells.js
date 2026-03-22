/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const src = path.join(__dirname, '..', 'PERSONNEL HISTORY STATEMENT.docx');
const zip = new PizZip(fs.readFileSync(src));
let xml = zip.file('word/document.xml').asText();

const labels = [
  'PRESENT JOB/ASSIGNMENT',
  'BUSINESS OR DUTY ADDRESS',
  'HOME ADDRESS',
  'DATE OF BIRTH',
  'CHANGE IN NAME',
  'NICKNAMES',
  'NATIONALITY',
  'TAX IDENTIFICATION',
  'MOBILE PHONE',
  'EMAIL ADDRESS',
  'PASSPORT NR',
];

labels.forEach((lab) => {
  const i = xml.indexOf(lab);
  if (i < 0) {
    console.log(lab, 'NOT FOUND');
    return;
  }
  const slice = xml.slice(i, i + 4000);
  const m = slice.match(/<w:p[^>]*w14:textId="([^"]+)"[^>]*>[\s\S]*?<\/w:p>\s*<\/w:tc>\s*<w:tc[^>]*>[\s\S]*?w14:textId="([^"]+)"/);
  console.log('\n===', lab, '===');
  if (m) console.log('labelPara', m[1], 'valueCellPara', m[2]);
  else console.log('parse fail, snippet:', slice.slice(0, 600).replace(/\s+/g, ' '));
});
