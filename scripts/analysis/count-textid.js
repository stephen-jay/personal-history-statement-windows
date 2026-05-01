const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const xml = new PizZip(fs.readFileSync(path.join(__dirname, '..', 'PERSONNEL HISTORY STATEMENT.docx')))
  .file('word/document.xml')
  .asText();
const ids = [
  '178278AE', '035C576C', '08928428', '1C1A315F', '77E4B5AA',
  '6C4C63E3', '33E4D1AB', '49A0E257', '0D1D6C55', '71881869', '2C95D578',
  '77777777',
];
ids.forEach((id) => {
  const re = new RegExp(`w14:textId="${id}"`, 'g');
  const n = (xml.match(re) || []).length;
  console.log(id, n);
});
