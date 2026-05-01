const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const x = new PizZip(fs.readFileSync(path.join(__dirname, '..', 'PERSONNEL HISTORY STATEMENT.docx')))
  .file('word/document.xml')
  .asText();
['3E3FAB14', '002C4AD6', '20ABF6EB', '10C640AD', '2B92EA5C'].forEach((id) => {
  console.log(id, (x.split('w14:textId="' + id + '"').length - 1));
});
