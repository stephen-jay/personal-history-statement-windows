'use strict';

const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  Footer,
  PageNumber,
  BorderStyle,
  ShadingType,
  ImageRun,
  VerticalAlign,
  UnderlineType,
  convertInchesToTwip,
} = require('docx');

const INSTRUCTIONS = [
  'Answer all the questions completely; If the question is not applicable, write "N/A". Write "UNKNOWN" only if you do not know the answer and cannot obtain the answer from personal records. Use the blank pages at the back of this form for extra details on any question for which you do not have sufficient space.',
  'Type, print or write carefully; illegible or incomplete forms will not receive consideration.',
  'WARNING: The correctness of all statements of entries made herein will be investigated.',
  'Any deliberate omission or distortion of material facts may give sufficient cause for denial of clearance.',
  'The statements made herein are classified CONFIDENTIAL. Revelation or use other than the authorized is prohibited.',
];

const HANDWRITING_SAMPLE =
  'As Luis E Repazo III of 105th Xavier Ave., Yale Mountain guzzled his way through three bottles of brandy, ' +
  'Josephine Z. Quinsing a partner in the law firm of San Diego and Ballesteros located at 2879 Valley Forge St., ' +
  'Quezon City turned to Richard Ting Sr., a chinese food expert from W. O. N. Kwantung Company Unltd., ' +
  '346 Hadji Jairul Hussein Blvd., and said: "I can\'t speak for my Government but I\'m quite sure your country ' +
  'and mine will be better together for closer understanding".';

const NAVY = '1B3358';
const LABEL_GRAY = 'D9D9D9';
const BORDER = { style: BorderStyle.SINGLE, size: 1, color: '000000' };
const TABLE_BORDERS = {
  top: BORDER,
  bottom: BORDER,
  left: BORDER,
  right: BORDER,
  insideHorizontal: BORDER,
  insideVertical: BORDER,
};

const SZ_BODY = 20;
const SZ_SMALL = 18;
const SZ_SECTION = 26;
const FONT = 'Arial';

function safeStr(x) {
  if (x == null) return '';
  var s = String(x);
  if (s === 'undefined' || s === 'null') return '';
  return s;
}

function trimVal(data, key) {
  return safeStr(data && data[key]).trim();
}

function runText(text, opts) {
  return new TextRun(
    Object.assign({ text: safeStr(text), font: FONT, size: SZ_BODY }, opts || {})
  );
}

function runVal(data, key) {
  var s = trimVal(data, key);
  if (!s) {
    return new TextRun({
      text: ' \u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0 ',
      font: FONT,
      size: SZ_BODY,
      underline: { type: UnderlineType.SINGLE },
    });
  }
  return new TextRun({ text: s, font: FONT, size: SZ_BODY });
}

function p(children, paraOpts) {
  return new Paragraph(
    Object.assign({ spacing: { after: 80 }, children: children }, paraOpts || {})
  );
}

function pText(text, paraOpts) {
  return p([runText(text)], paraOpts);
}

function pHeading(text, paraOpts) {
  return new Paragraph(
    Object.assign(
      {
        spacing: { after: 80 },
        children: [new TextRun({ text: text, bold: true, font: FONT, size: SZ_BODY })],
      },
      paraOpts || {}
    )
  );
}

function cellPara(children, cellOpts) {
  return new TableCell(
    Object.assign(
      {
        margins: { top: 40, bottom: 40, left: 100, right: 100 },
        children: [new Paragraph({ children: children })],
        verticalAlign: VerticalAlign.CENTER,
      },
      cellOpts || {}
    )
  );
}

function labelCell(text, widthPct, extra) {
  return cellPara([runText(text, { size: SZ_BODY })], Object.assign({
    width: widthPct != null ? { size: widthPct, type: WidthType.PERCENTAGE } : undefined,
    shading: { fill: LABEL_GRAY, type: ShadingType.CLEAR },
  }, extra));
}

function valueCellFromRuns(runs, widthPct, extra) {
  return new TableCell(
    Object.assign(
      {
        margins: { top: 40, bottom: 40, left: 100, right: 100 },
        shading: { fill: 'FFFFFF', type: ShadingType.CLEAR },
        width: widthPct != null ? { size: widthPct, type: WidthType.PERCENTAGE } : undefined,
        children: [new Paragraph({ children: runs })],
        verticalAlign: VerticalAlign.CENTER,
      },
      extra || {}
    )
  );
}

function valueCell(data, key, widthPct) {
  return valueCellFromRuns([runVal(data, key)], widthPct);
}

function kvRow(label, runsOrDataKey, data) {
  var runs =
    typeof runsOrDataKey === 'string'
      ? [runVal(data, runsOrDataKey)]
      : runsOrDataKey;
  return new TableRow({
    children: [labelCell(label, 32), valueCellFromRuns(runs, 68)],
  });
}

function sectionBanner(title) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TABLE_BORDERS,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: NAVY, type: ShadingType.CLEAR },
            margins: { top: 100, bottom: 100, left: 160, right: 160 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: title,
                    bold: true,
                    color: 'FFFFFF',
                    font: FONT,
                    size: SZ_SECTION,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function borderedDataTable(headerLabels, rows) {
  var headCells = headerLabels.map(function (h) {
    return cellPara(
      [
        new TextRun({
          text: h,
          bold: true,
          font: FONT,
          size: SZ_BODY,
          underline: { type: UnderlineType.SINGLE },
        }),
      ],
      { shading: { fill: 'F2F2F2', type: ShadingType.CLEAR } }
    );
  });
  var tableRows = [
    new TableRow({ children: headCells }),
  ];
  rows.forEach(function (cells) {
    tableRows.push(
      new TableRow({
        children: cells.map(function (txt) {
          return cellPara([runText(txt || ' ', { size: SZ_BODY })], {
            shading: { fill: 'FFFFFF', type: ShadingType.CLEAR },
          });
        }),
      })
    );
  });
  if (rows.length === 0) {
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            columnSpan: headerLabels.length,
            margins: { top: 40, bottom: 40, left: 100, right: 100 },
            children: [new Paragraph({ children: [runText(' ', { size: SZ_BODY })] })],
          }),
        ],
      })
    );
  }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TABLE_BORDERS,
    rows: tableRows,
  });
}

function ynRuns(value) {
  var s = trimVal({ v: value }, 'v');
  var lower = s.toLowerCase();
  var yes = lower === 'yes' || lower === 'y' || lower.indexOf('yes') === 0;
  var no = lower === 'no' || lower === 'n' || lower.indexOf('no') === 0;
  var yBox = yes ? '\u2611' : '\u2610';
  var nBox = no ? '\u2611' : '\u2610';
  var runs = [
    runText('YES ', {}),
    new TextRun({ text: yBox, font: FONT, size: SZ_BODY }),
    runText('   NO ', {}),
    new TextRun({ text: nBox, font: FONT, size: SZ_BODY }),
  ];
  if (s && !yes && !no) {
    runs.push(runText('   ' + s, {}));
  }
  return runs;
}

function joinKeys(data, keys) {
  var parts = keys.map(function (k) {
    return trimVal(data, k);
  }).filter(Boolean);
  return parts.join(' \u00B7 ');
}

function personalDetailsTable(data) {
  var letterOpts = { shading: { fill: 'EEEEEE', type: ShadingType.CLEAR } };
  function letterCell(ch) {
    return cellPara([runText(ch, { bold: true })], Object.assign({ width: { size: 4, type: WidthType.PERCENTAGE } }, letterOpts));
  }
  function promptCell(t, span) {
    return cellPara([runText(t, { size: SZ_SMALL })], { columnSpan: span || 1 });
  }
  function valSpan(key, span) {
    return valueCellFromRuns([runVal(data, key)], undefined, { columnSpan: span });
  }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TABLE_BORDERS,
    rows: [
      new TableRow({
        children: [
          new TableCell(
            Object.assign(
              {
                rowSpan: 3,
                margins: { top: 40, bottom: 40, left: 80, right: 80 },
                verticalAlign: VerticalAlign.CENTER,
                shading: letterOpts.shading,
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [runText('A.', { bold: true })] })],
              },
              { width: { size: 4, type: WidthType.PERCENTAGE } }
            )
          ),
          promptCell('Name', 6),
        ],
      }),
      new TableRow({
        children: [
          valueCellFromRuns([runVal(data, 'nameLast')], undefined, { columnSpan: 2 }),
          valueCellFromRuns([runVal(data, 'nameFirst')], undefined, { columnSpan: 2 }),
          valueCellFromRuns([runVal(data, 'nameMiddle')], undefined, { columnSpan: 2 }),
        ],
      }),
      new TableRow({
        children: [
          cellPara([runText('(Last)', { italics: true, size: SZ_SMALL })], { columnSpan: 2 }),
          cellPara([runText('(First)', { italics: true, size: SZ_SMALL })], { columnSpan: 2 }),
          cellPara([runText('(Middle/Maternal)', { italics: true, size: SZ_SMALL })], { columnSpan: 2 }),
        ],
      }),
      new TableRow({
        children: [
          letterCell('C.'),
          promptCell('PRESENT JOB/ASSIGNMENT:', 2),
          valSpan('presentJob', 4),
        ],
      }),
      new TableRow({
        children: [
          letterCell('D.'),
          promptCell('BUSINESS OR DUTY ADDRESS:', 2),
          valSpan('businessAddress', 4),
        ],
      }),
      new TableRow({
        children: [
          letterCell('E.'),
          promptCell('HOME ADDRESS (Include Street & No.):', 2),
          valSpan('homeAddress', 4),
        ],
      }),
      new TableRow({
        children: [
          letterCell('F.'),
          promptCell('DATE OF BIRTH:', 2),
          valSpan('dateOfBirth', 2),
          promptCell('PLACE OF BIRTH:', 1),
          valueCell(data, 'placeOfBirth', undefined),
        ],
      }),
      new TableRow({
        children: [
          letterCell('G.'),
          promptCell('CHANGE IN NAME (If by Court Action give details):', 2),
          valSpan('changeInName', 4),
        ],
      }),
      new TableRow({
        children: [
          letterCell('H.'),
          promptCell('NICKNAMES:', 1),
          valSpan('nicknames', 2),
          promptCell('NATIONALITY:', 2),
          valueCell(data, 'nationality', undefined),
        ],
      }),
      new TableRow({
        children: [
          letterCell('I.'),
          promptCell('TAX IDENTIFICATION NR.:', 1),
          valSpan('taxId', 2),
          promptCell('TEL. NO.:', 2),
          valueCell(data, 'telNo', undefined),
        ],
      }),
      new TableRow({
        children: [
          letterCell('J.'),
          promptCell('MOBILE PHONE NR.:', 1),
          valSpan('mobile', 2),
          promptCell('EMAIL ADDRESS:', 2),
          valueCell(data, 'email', undefined),
        ],
      }),
      new TableRow({
        children: [
          letterCell('K.'),
          promptCell('PASSPORT NR.:', 1),
          valSpan('passportNr', 2),
          promptCell('DATE OF EXPIRATION:', 2),
          valueCell(data, 'passportExpiry', undefined),
        ],
      }),
    ],
  });
}

function characteristicsTable(data) {
  function charCell(label, key) {
    return new TableCell({
      margins: { top: 40, bottom: 40, left: 80, right: 80 },
      borders: TABLE_BORDERS,
      shading: { fill: 'FFFFFF', type: ShadingType.CLEAR },
      children: [
        new Paragraph({
          children: [runText(label, { size: SZ_SMALL, color: '444444' })],
        }),
        new Paragraph({ children: [runVal(data, key)] }),
      ],
      verticalAlign: VerticalAlign.TOP,
    });
  }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TABLE_BORDERS,
    rows: [
      new TableRow({
        children: [
          charCell('Sex', 'sex'),
          charCell('Age', 'age'),
          charCell('Height (m)', 'height'),
          charCell('Weight (kg)', 'weight'),
        ],
      }),
      new TableRow({
        children: [
          charCell('Build', 'build'),
          charCell('Complexion', 'complexion'),
          charCell('Color of Eyes', 'colorEyes'),
          charCell('Color of Hair', 'colorHair'),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 4,
            margins: { top: 40, bottom: 40, left: 80, right: 80 },
            shading: { fill: 'FFFFFF', type: ShadingType.CLEAR },
            children: [
              new Paragraph({ children: [runText('Scar, marks, or distinguishing features', { size: SZ_SMALL })] }),
              new Paragraph({ children: [runVal(data, 'scarMarks')] }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          charCell('Present state of health', 'healthState'),
          charCell('Recent serious illness', 'recentIllness'),
          new TableCell({
            columnSpan: 2,
            margins: { top: 40, bottom: 40, left: 80, right: 80 },
            shading: { fill: 'FFFFFF', type: ShadingType.CLEAR },
            children: [
              new Paragraph({ children: [runText('Blood type', { size: SZ_SMALL })] }),
              new Paragraph({ children: [runVal(data, 'bloodType')] }),
            ],
          }),
        ],
      }),
    ],
  });
}

function signatureApplicantLines() {
  return [
    p([
      new TextRun({
        text: '_______________________________',
        font: FONT,
        size: SZ_BODY,
      }),
    ]),
    pText('(Signature of Applicant)', { alignment: AlignmentType.CENTER, spacing: { after: 160 } }),
    p([
      new TextRun({
        text: '_______________________________',
        font: FONT,
        size: SZ_BODY,
      }),
    ]),
    pText('(Signature of Applicant)', { alignment: AlignmentType.CENTER, spacing: { after: 160 } }),
  ];
}

function photoParagraph(data) {
  if (!trimVal(data, 'photoDataUrl')) {
    return p([runText('Photo on file / attach printout', { italics: true })], { spacing: { after: 120 } });
  }
  try {
    return new Paragraph({
      spacing: { after: 120 },
      children: [
        new ImageRun({
          data: data.photoDataUrl,
          transformation: { width: 120, height: 120 },
        }),
      ],
    });
  } catch (_) {
    return p([runText('Photo on file / attach printout', { italics: true })], { spacing: { after: 120 } });
  }
}

function buildPhsDocument(data) {
  data = data || {};
  var children = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: 'PERSONNEL HISTORY STATEMENT',
          bold: true,
          font: FONT,
          size: 28,
        }),
      ],
    })
  );
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: 'Strictly Confidential \u2013 For Official Use Only',
          font: FONT,
          size: SZ_BODY,
          italics: true,
        }),
      ],
    })
  );

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              margins: { top: 120, bottom: 120, left: 160, right: 160 },
              shading: { fill: 'F7F7F7', type: ShadingType.CLEAR },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'I N S T R U C T I O N S',
                      bold: true,
                      font: FONT,
                      size: SZ_SECTION,
                    }),
                  ],
                }),
              ].concat(
                INSTRUCTIONS.map(function (t, i) {
                  return new Paragraph({
                    spacing: { after: 80 },
                    children: [runText(String(i + 1) + '. ' + t, { size: SZ_BODY })],
                  });
                })
              ),
            }),
          ],
        }),
      ],
    })
  );

  children.push(p([], { spacing: { after: 120 } }));

  children.push(sectionBanner('I. PERSONAL DETAILS'));
  children.push(personalDetailsTable(data));
  children.push(p([], { spacing: { after: 160 } }));

  children.push(sectionBanner('II. PERSONAL CHARACTERISTICS'));
  children.push(characteristicsTable(data));
  children.push.apply(children, signatureApplicantLines());
  children.push(p([], { spacing: { after: 160 } }));

  children.push(sectionBanner('III. MARITAL HISTORY'));
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: TABLE_BORDERS,
      rows: [
        kvRow('Marital status', 'maritalStatus', data),
        kvRow('Name of spouse', 'spouseName', data),
        kvRow('Date & place of marriage', 'marriageDatePlace', data),
        kvRow('Date & place of birth of spouse', 'spouseDob', data),
        kvRow(
          'Occupation / employer, contact, citizenship (state if dual)',
          [
            runText(
              joinKeys(data, ['spousePlaceBirth', 'spouseOccupation', 'spouseContact', 'spouseCitizenship']) ||
                ' \u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0 ',
              joinKeys(data, ['spousePlaceBirth', 'spouseOccupation', 'spouseContact', 'spouseCitizenship'])
                ? {}
                : { underline: { type: UnderlineType.SINGLE } }
            ),
          ],
          data
        ),
      ],
    })
  );
  var childRows = Array.isArray(data.children) ? data.children : [];
  children.push(pHeading('Children', { spacing: { before: 120, after: 60 } }));
  children.push(
    borderedDataTable(
      ['Name', 'Date of Birth', 'Citizenship / Address', 'Name of Father / Mother'],
      childRows.map(function (row) {
        return [
          trimVal(row, 'name'),
          trimVal(row, 'dob'),
          trimVal(row, 'citizenshipAddress'),
          trimVal(row, 'fatherMother'),
        ];
      })
    )
  );
  children.push(p([], { spacing: { after: 160 } }));

  children.push(sectionBanner('IV. FAMILY HISTORY AND INFORMATION'));

  function familyBlock(title, lines) {
    var rows = lines.map(function (ln) {
      return kvRow(ln[0], ln[1], data);
    });
    children.push(pHeading(title, { spacing: { before: 80, after: 60 } }));
    children.push(
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: TABLE_BORDERS, rows: rows })
    );
  }

  familyBlock('Father', [
    ['Full name', 'fatherName'],
    ['Date & place of birth', 'fatherDobPlace'],
    ['Address', 'fatherAddress'],
    ['Occupation', 'fatherOccupation'],
    ['Citizenship / naturalization', 'fatherCitizenship'],
  ]);
  familyBlock('Mother', [
    ['Full name', 'motherName'],
    ['Date & place of birth', 'motherDobPlace'],
    ['Address', 'motherAddress'],
    ['Occupation', 'motherOccupation'],
    ['Citizenship / naturalization', 'motherCitizenship'],
  ]);

  children.push(pHeading('Brothers & sisters', { spacing: { before: 120, after: 60 } }));
  children.push(
    borderedDataTable(
      ['Name', 'Date of Birth', 'Citizenship', 'Address', 'Occupation', 'Employer / Address'],
      [
        [
          trimVal(data, 'siblingsName'),
          trimVal(data, 'siblingsDob'),
          trimVal(data, 'siblingsCitizenship'),
          trimVal(data, 'siblingsAddress'),
          trimVal(data, 'siblingsOccupation'),
          trimVal(data, 'siblingsEmployerAddress'),
        ],
      ].filter(function (r) {
        return r.some(Boolean);
      })
    )
  );

  familyBlock('Step-parent or guardian', [
    ['Full name', 'stepParentFullName'],
    ['Date & place of birth', 'stepParentDob'],
    ['Address', 'stepParentAddress'],
    ['Occupation', 'stepParentOccupation'],
    ['Citizenship / naturalization', 'stepParentCitizenship'],
  ]);
  familyBlock('Father-in-law', [
    ['Full name', 'fatherInLawFullName'],
    ['Date & place of birth', 'fatherInLawDob'],
    ['Address', 'fatherInLawAddress'],
    ['Occupation', 'fatherInLawOccupation'],
    ['Citizenship / naturalization', 'fatherInLawCitizenship'],
  ]);
  familyBlock('Mother-in-law', [
    ['Full name', 'motherInLawFullName'],
    ['Date & place of birth', 'motherInLawDob'],
    ['Address', 'motherInLawAddress'],
    ['Occupation', 'motherInLawOccupation'],
    ['Citizenship / naturalization', 'motherInLawCitizenship'],
  ]);
  children.push(p([], { spacing: { after: 160 } }));

  children.push(sectionBanner('V. EDUCATIONAL BACKGROUND'));
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            cellPara([runText('Level', { bold: true, underline: { type: UnderlineType.SINGLE } })], {
              shading: { fill: 'F2F2F2', type: ShadingType.CLEAR },
            }),
            cellPara([runText('School name / location', { bold: true, underline: { type: UnderlineType.SINGLE } })], {
              shading: { fill: 'F2F2F2', type: ShadingType.CLEAR },
            }),
            cellPara([runText('Date of attendance', { bold: true, underline: { type: UnderlineType.SINGLE } })], {
              shading: { fill: 'F2F2F2', type: ShadingType.CLEAR },
            }),
            cellPara([runText('Year graduated', { bold: true, underline: { type: UnderlineType.SINGLE } })], {
              shading: { fill: 'F2F2F2', type: ShadingType.CLEAR },
            }),
          ],
        }),
        new TableRow({
          children: [
            labelCell('Elementary', 18),
            valueCell(data, 'elemLocation', undefined),
            valueCell(data, 'elemAttendance', undefined),
            valueCell(data, 'elemGraduated', undefined),
          ],
        }),
        new TableRow({
          children: [
            labelCell('High school', 18),
            valueCell(data, 'hsLocation', undefined),
            valueCell(data, 'hsAttendance', undefined),
            valueCell(data, 'hsGraduated', undefined),
          ],
        }),
        new TableRow({
          children: [
            labelCell('College', 18),
            valueCell(data, 'collegeLocation', undefined),
            valueCell(data, 'collegeAttendance', undefined),
            valueCell(data, 'collegeGraduated', undefined),
          ],
        }),
        new TableRow({
          children: [
            labelCell('Post graduate', 18),
            valueCell(data, 'pgLocation', undefined),
            valueCell(data, 'pgCourseAttendance', undefined),
            valueCell(data, 'pgGraduated', undefined),
          ],
        }),
      ],
    })
  );
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: TABLE_BORDERS,
      rows: [
        kvRow('Other schools / training attended', 'otherSchools', data),
        kvRow('Civil service eligibility & similar qualifications', 'civilServiceEligibility', data),
      ],
    })
  );
  children.push(p([], { spacing: { after: 160 } }));

  children.push(sectionBanner('VI. PLACES OF RESIDENCE SINCE BIRTH'));
  var por = Array.isArray(data.placesOfResidence) ? data.placesOfResidence : [];
  children.push(
    borderedDataTable(
      ['Inclusive dates', 'Address'],
      por.map(function (row) {
        return [trimVal(row, 'inclusiveDates'), trimVal(row, 'address')];
      })
    )
  );
  children.push(p([], { spacing: { after: 160 } }));

  children.push(sectionBanner('VII. EMPLOYMENT & TRAINING'));
  var emp = Array.isArray(data.employmentHistory) ? data.employmentHistory : [];
  children.push(
    borderedDataTable(
      ['Inclusive date', 'Type of employment', 'Name & address of employer', 'Reason for leaving'],
      emp.map(function (row) {
        return [
          trimVal(row, 'inclusiveDate'),
          trimVal(row, 'type'),
          trimVal(row, 'employerAddress'),
          trimVal(row, 'reasonForLeaving'),
        ];
      })
    )
  );
  children.push(pHeading('Seminars & training', { spacing: { before: 120, after: 60 } }));
  var sem = Array.isArray(data.seminarsTraining) ? data.seminarsTraining : [];
  children.push(
    borderedDataTable(
      ['Inclusive date', 'Name', 'Conducted by', 'Remarks'],
      sem.map(function (row) {
        return [
          trimVal(row, 'inclusiveDate'),
          trimVal(row, 'name'),
          trimVal(row, 'conductedBy'),
          trimVal(row, 'remarks'),
        ];
      })
    )
  );
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: TABLE_BORDERS,
      rows: [
        kvRow('Have you ever been dismissed or forced to resign? (explain)', 'dismissedResign', data),
      ],
    })
  );
  children.push(p([], { spacing: { after: 160 } }));

  children.push(sectionBanner('VIII. FOREIGN COUNTRIES VISITED'));
  var fc = Array.isArray(data.foreignCountries) ? data.foreignCountries : [];
  children.push(
    borderedDataTable(
      ['Date of visit', 'Country visited', 'Purpose of visit', 'Address abroad'],
      fc.map(function (row) {
        return [
          trimVal(row, 'dateOfVisit'),
          trimVal(row, 'country'),
          trimVal(row, 'purpose'),
          trimVal(row, 'addressAbroad'),
        ];
      })
    )
  );
  children.push(p([], { spacing: { after: 160 } }));

  children.push(sectionBanner('IX. CREDIT REPUTATION'));
  children.push(
    p(
      [runText('Entirely dependent on salary? If NO, state other source of income: ', { size: SZ_BODY })].concat(
        ynRuns(data.salaryDependent)
      ),
      { spacing: { after: 120 } }
    )
  );
  var banks = Array.isArray(data.banksCredit) ? data.banksCredit : [];
  children.push(
    borderedDataTable(
      ['Nature of account', 'Bank / institution', 'Address'],
      banks.map(function (row) {
        return [trimVal(row, 'natureOfAccount'), trimVal(row, 'name'), trimVal(row, 'address')];
      })
    )
  );
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: TABLE_BORDERS,
      rows: [
        kvRow('Statement of assets & liabilities (filed / details)', 'salFiled', data),
        kvRow('Income tax return (last calendar year)', 'incomeTaxFiled', data),
      ],
    })
  );
  var cref = Array.isArray(data.creditReferences) ? data.creditReferences : [];
  children.push(pHeading('Three credit references', { spacing: { before: 80, after: 60 } }));
  children.push(
    borderedDataTable(
      ['Name', 'Address'],
      cref.map(function (row) {
        return [trimVal(row, 'name'), trimVal(row, 'address')];
      })
    )
  );
  children.push(p([], { spacing: { after: 160 } }));

  children.push(sectionBanner('X. ARREST RECORD AND CONDUCT'));
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: TABLE_BORDERS,
      rows: [
        kvRow(
          'Ever investigated, arrested, indicted, or convicted? (If yes: court, offense, disposition)',
          'arrestRecord',
          data
        ),
        kvRow('Immediate family member investigated or arrested?', 'familyArrest', data),
        kvRow('Charged in any administrative case?', 'adminCase', data),
        kvRow('Arrested or detained under PD 1081?', 'pd1081', data),
        kvRow('Use of intoxicating liquor or illegal drugs', 'liquorDrugs', data),
      ],
    })
  );
  children.push(p([], { spacing: { after: 160 } }));

  children.push(sectionBanner('XI. GENERAL REPUTATION'));
  var ch = Array.isArray(data.characterRefs) ? data.characterRefs : [];
  children.push(pHeading('Five character references', { spacing: { after: 60 } }));
  children.push(
    borderedDataTable(
      ['Name', 'Address'],
      ch.map(function (row) {
        return [trimVal(row, 'name'), trimVal(row, 'address')];
      })
    )
  );
  var nb = Array.isArray(data.neighbors) ? data.neighbors : [];
  children.push(pHeading('Three neighbors', { spacing: { before: 80, after: 60 } }));
  children.push(
    borderedDataTable(
      ['Name', 'Address'],
      nb.map(function (row) {
        return [trimVal(row, 'name'), trimVal(row, 'address')];
      })
    )
  );
  children.push(p([], { spacing: { after: 160 } }));

  children.push(sectionBanner('XII. ORGANIZATIONS'));
  var org = Array.isArray(data.organizations) ? data.organizations : [];
  children.push(
    borderedDataTable(
      ['Organization', 'Address', 'Date of membership', 'Position held'],
      org.map(function (row) {
        return [
          trimVal(row, 'organization'),
          trimVal(row, 'address'),
          trimVal(row, 'membershipDate'),
          trimVal(row, 'positionHeld'),
        ];
      })
    )
  );
  children.push(p([], { spacing: { after: 160 } }));

  children.push(sectionBanner('XIII. MISCELLANEOUS'));
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: TABLE_BORDERS,
      rows: [kvRow('Hobbies, sports, pastimes', 'hobbies', data)],
    })
  );
  var lang = Array.isArray(data.languages) ? data.languages : [];
  children.push(pHeading('Languages & dialects', { spacing: { before: 120, after: 60 } }));
  children.push(
    borderedDataTable(
      ['Language / dialect', 'Speak', 'Read', 'Write'],
      lang.map(function (row) {
        return [
          trimVal(row, 'languageDialect'),
          trimVal(row, 'speak'),
          trimVal(row, 'read'),
          trimVal(row, 'write'),
        ];
      })
    )
  );
  children.push(
    p(
      [runText('Willingness for lie detector test: ', { size: SZ_BODY })].concat(ynRuns(data.lieDetector)),
      { spacing: { after: 120 } }
    )
  );

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              margins: { top: 120, bottom: 120, left: 160, right: 160 },
              shading: { fill: 'FAFAFA', type: ShadingType.CLEAR },
              children: [
                new Paragraph({
                  spacing: { after: 100 },
                  children: [
                    new TextRun({
                      text: 'G. Copy exactly the following paragraph in your own handwriting:',
                      bold: true,
                      font: FONT,
                      size: SZ_BODY,
                    }),
                  ],
                }),
                new Paragraph({
                  spacing: { after: 160 },
                  children: [runText(HANDWRITING_SAMPLE, { size: SZ_SMALL })],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: '_________________________________________________________________',
                      font: FONT,
                      size: SZ_BODY,
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: '_________________________________________________________________',
                      font: FONT,
                      size: SZ_BODY,
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: '_________________________________________________________________',
                      font: FONT,
                      size: SZ_BODY,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  children.push(
    p(
      [
        runText(
          'I certify that the following answers are true and correct to the best of my knowledge and belief and I agree that my misstatement or omission as to material facts will constitute ground for denial of my application for clearance.',
          { size: SZ_SMALL }
        ),
      ],
      { spacing: { after: 200 } }
    )
  );

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 42, type: WidthType.PERCENTAGE },
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              shading: { fill: 'FFFFFF', type: ShadingType.CLEAR },
              children: [
                new Paragraph({
                  children: [runText('Signed at: ', {}), runVal(data, 'signedAtCert')],
                }),
                new Paragraph({
                  spacing: { before: 100 },
                  children: [runText('Date: ', {}), runVal(data, 'signedDateCert')],
                }),
              ],
            }),
            new TableCell({
              width: { size: 58, type: WidthType.PERCENTAGE },
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              shading: { fill: 'FFFFFF', type: ShadingType.CLEAR },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: '_______________________________',
                      font: FONT,
                      size: SZ_BODY,
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [runText('(Signature of Applicant)', { size: SZ_SMALL })],
                }),
                new Paragraph({
                  spacing: { before: 120 },
                  children: [
                    new TextRun({
                      text: '_______________________________',
                      font: FONT,
                      size: SZ_BODY,
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [runText('Witness', { size: SZ_SMALL })],
                }),
                new Paragraph({
                  spacing: { before: 120 },
                  children: [
                    new TextRun({
                      text: '_______________________________',
                      font: FONT,
                      size: SZ_BODY,
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [runText('Witness', { size: SZ_SMALL })],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              margins: { top: 80, bottom: 80, left: 100, right: 100 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'THUMB MARK', bold: true, font: FONT, size: SZ_BODY }),
                  ],
                }),
                new Paragraph({
                  spacing: { before: 80 },
                  children: [
                    runText('\u2610 (Left)     \u2610 (Right)', {}),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              margins: { top: 80, bottom: 80, left: 100, right: 100 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: '2\u00D72 Photo \u2014 Passport size',
                      bold: true,
                      font: FONT,
                      size: SZ_BODY,
                    }),
                  ],
                }),
                photoParagraph(data),
              ],
            }),
          ],
        }),
      ],
    })
  );

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: TABLE_BORDERS,
      rows: [
        kvRow('Subscribed and sworn before me (day, month, Philippines, place)', [
          new TextRun({
            text:
              'This ' +
              (trimVal(data, 'swornDay') || '____') +
              ' day of ' +
              (trimVal(data, 'swornMonth') || '____') +
              ', Philippines. Place: ' +
              (trimVal(data, 'swornPlace') || ''),
            font: FONT,
            size: SZ_BODY,
          }),
        ]),
      ],
    })
  );
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            cellPara([runText('Residence Certificate Nr.: ', {}), runVal(data, 'residenceCertNr2')], {
              shading: { fill: 'FFFFFF', type: ShadingType.CLEAR },
            }),
            cellPara([runText('Issued on: ', {}), runVal(data, 'residenceCertIssuedOn2')], {
              shading: { fill: 'FFFFFF', type: ShadingType.CLEAR },
            }),
            cellPara([runText('Issued at: ', {}), runVal(data, 'residenceCertIssuedAt2')], {
              shading: { fill: 'FFFFFF', type: ShadingType.CLEAR },
            }),
          ],
        }),
      ],
    })
  );
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: TABLE_BORDERS,
      rows: [kvRow('Administering officer', 'administeringOfficer2', data)],
    })
  );
  children.push(
    new Paragraph({
      spacing: { before: 120, after: 60 },
      children: [
        new TextRun({
          text: '___________________________________________________________',
          font: FONT,
          size: SZ_BODY,
        }),
      ],
    })
  );
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [runText('Signature / stamp', { size: SZ_SMALL })],
    })
  );

  var inch = convertInchesToTwip;
  return new Document({
    features: { updateFields: true },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: inch(8.5),
              height: inch(11),
            },
            margin: {
              top: inch(1),
              right: inch(1),
              bottom: inch(1),
              left: inch(1),
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'CONFIDENTIAL | Personnel History Statement | Page ',
                    font: FONT,
                    size: SZ_SMALL,
                    color: '555555',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: FONT,
                    size: SZ_SMALL,
                    color: '555555',
                  }),
                  new TextRun({
                    text: ' of ',
                    font: FONT,
                    size: SZ_SMALL,
                    color: '555555',
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    font: FONT,
                    size: SZ_SMALL,
                    color: '555555',
                  }),
                ],
              }),
            ],
          }),
        },
        children: children,
      },
    ],
  });
}

async function buildPhsDocxBuffer(data) {
  var doc = buildPhsDocument(data);
  return Packer.toBuffer(doc);
}

module.exports = {
  buildPhsDocxBuffer,
  buildPhsDocument,
};
