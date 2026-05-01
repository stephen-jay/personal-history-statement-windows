const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const x = new PizZip(fs.readFileSync(path.join(__dirname, '..', 'PERSONNEL HISTORY STATEMENT.docx')))
  .file('word/document.xml')
  .asText();
const id = process.argv[2] || '20ABF6EB';
const i = x.indexOf('w14:textId="' + id + '"');
console.log(x.slice(i, i + 4500));
