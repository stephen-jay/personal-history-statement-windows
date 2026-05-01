const fs = require('fs');
const path = require('path');

const IMAGE_FIELD_TYPES = [
  { dbField: 'photoDataUrl', imageType: 'IDPICTURE' },
  { dbField: 'signatureDataUrl', imageType: 'SIGNATURE' },
  { dbField: 'handwrittenEntryDataUrl', imageType: 'HANDWRITTENENTRY' },
  { dbField: 'leftThumbMarkDataUrl', imageType: 'LEFTTHUMB' },
  { dbField: 'rightThumbMarkDataUrl', imageType: 'RIGHTTHUMB' },
];

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
};

/**
 * Image storage utility
 * Hybrid approach:
 * - Database stores base64 data URLs as the source of truth
 * - Disk keeps an organized archive copy per personnel and image type
 */

function getPersonnelId(record) {
  const lastName = String((record && record.nameLast) || '').trim().replace(/\s+/g, '');
  const firstName = String((record && record.nameFirst) || '').trim();
  const middleName = String((record && record.nameMiddle) || '').trim();

  if (!lastName) return null;

  const initials = [];
  if (firstName) initials.push(firstName.charAt(0).toUpperCase());
  if (middleName) initials.push(middleName.charAt(0).toUpperCase());

  return `${lastName.toUpperCase()}_${initials.join('')}`;
}

function ensureFolder(folderPath) {
  if (!folderPath) return false;
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
  return true;
}

function writeImageToDisk(baseUploadDir, record, imageType, base64DataUrl) {
  if (!baseUploadDir || !record || !imageType || !base64DataUrl) return null;

  const match = String(base64DataUrl).match(/^data:(image\/[^;,]+)(?:;[^,]*)?;base64,(.+)$/);
  if (!match) return null;

  const personnelId = getPersonnelId(record);
  if (!personnelId) return null;

  const [, mimeType, base64Data] = match;
  const format = mimeType.split('/')[1] || 'jpg';
  const ext = format === 'jpeg' ? 'jpg' : format.replace('svg+xml', 'svg');
  const personnelFolder = path.join(baseUploadDir, personnelId);
  const imageFolder = path.join(personnelFolder, imageType);
  ensureFolder(imageFolder);

  const fileName = `${personnelId}-${imageType}.${ext}`;
  const filePath = path.join(imageFolder, fileName);
  const buffer = Buffer.from(base64Data, 'base64');
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

function archiveRecordImages(baseUploadDir, record) {
  if (!baseUploadDir || !record) return null;

  IMAGE_FIELD_TYPES.forEach(function (def) {
    const value = record[def.dbField];
    if (typeof value === 'string' && value.startsWith('data:')) {
      writeImageToDisk(baseUploadDir, record, def.imageType, value);
    }
  });

  return true;
}

/**
 * Process record images: no-op - images are stored as base64 in database
 */
function processRecordImages(baseUploadDir, record) {
  return hydrateRecordImages(baseUploadDir, record, { preserveUnresolved: true });
}

function isRenderableDataUrl(value) {
  return /^data:image\/[^,]+,/i.test(String(value || ''));
}

function isImageFile(filePath) {
  return !!MIME_BY_EXT[path.extname(String(filePath || '')).toLowerCase()];
}

function fileToDataUrl(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME_BY_EXT[ext];
  if (!mimeType) return null;
  const buffer = fs.readFileSync(filePath);
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

function getLegacyPersonnelFolderName(record) {
  const parts = [
    record && record.nameLast,
    record && record.nameFirst,
    record && record.nameMiddle,
  ].map(function (value) {
    return String(value || '').trim();
  }).filter(Boolean);
  return parts.join(' ');
}

function getLegacyFileBase(record, imageType) {
  const lastName = String((record && record.nameLast) || '').trim().replace(/\s+/g, '');
  const firstName = String((record && record.nameFirst) || '').trim();
  const middleName = String((record && record.nameMiddle) || '').trim();
  if (!lastName) return null;

  const suffixByType = {
    IDPICTURE: 'IDPicture',
    SIGNATURE: 'Signature',
    HANDWRITTENENTRY: 'HandwrittenEntry',
    LEFTTHUMB: 'LeftThumb',
    RIGHTTHUMB: 'RightThumb',
  };
  const suffix = suffixByType[imageType];
  if (!suffix) return null;

  const initials = (firstName ? firstName.charAt(0).toUpperCase() : '') +
    (middleName ? middleName.charAt(0).toUpperCase() : '');
  return `${lastName}${initials}-${suffix}`;
}

function findImageByBaseName(folderPath, fileBase) {
  if (!folderPath || !fileBase || !fs.existsSync(folderPath)) return null;
  const exts = Object.keys(MIME_BY_EXT);
  for (const ext of exts) {
    const candidate = path.join(folderPath, fileBase + ext);
    if (fs.existsSync(candidate) && isImageFile(candidate)) return candidate;
  }
  return null;
}

function resolveImagePath(baseUploadDir, record, imageType, rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) return null;

  const fileUrlPrefix = 'file:///';
  if (value.toLowerCase().startsWith(fileUrlPrefix)) {
    try {
      const decoded = decodeURIComponent(value.slice(fileUrlPrefix.length)).replace(/\//g, path.sep);
      if (fs.existsSync(decoded) && isImageFile(decoded)) return decoded;
    } catch (_) {}
  }

  const candidates = [];
  if (path.isAbsolute(value)) candidates.push(value);
  if (baseUploadDir) {
    candidates.push(path.join(baseUploadDir, value));
    candidates.push(path.join(path.dirname(baseUploadDir), value));
  }

  const legacyFolder = getLegacyPersonnelFolderName(record);
  const legacyBase = getLegacyFileBase(record, imageType);
  if (baseUploadDir && legacyFolder) {
    candidates.push(path.join(baseUploadDir, legacyFolder, path.basename(value)));
    candidates.push(path.join(path.dirname(baseUploadDir), legacyFolder, path.basename(value)));
  }
  if (baseUploadDir && legacyBase) {
    candidates.push(path.join(baseUploadDir, legacyFolder || '', legacyBase + path.extname(value)));
    candidates.push(path.join(path.dirname(baseUploadDir), legacyFolder || '', legacyBase + path.extname(value)));
    candidates.push(path.join(baseUploadDir, getPersonnelId(record) || '', imageType, legacyBase + path.extname(value)));
  }

  const personnelId = getPersonnelId(record);
  if (baseUploadDir && personnelId) {
    const ext = path.extname(value);
    candidates.push(path.join(baseUploadDir, personnelId, imageType, `${personnelId}-${imageType}${ext}`));
    candidates.push(path.join(baseUploadDir, personnelId, `${personnelId}-${imageType}${ext}`));
  }

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate) && isImageFile(candidate)) return candidate;
  }

  if (baseUploadDir && legacyFolder && legacyBase) {
    return findImageByBaseName(path.join(baseUploadDir, legacyFolder), legacyBase) ||
      findImageByBaseName(path.join(path.dirname(baseUploadDir), legacyFolder), legacyBase) ||
      findImageByBaseName(path.join(baseUploadDir, getPersonnelId(record) || '', imageType), legacyBase);
  }

  if (baseUploadDir && personnelId) {
    return findImageByBaseName(path.join(baseUploadDir, personnelId, imageType), `${personnelId}-${imageType}`) ||
      findImageByBaseName(path.join(baseUploadDir, personnelId), `${personnelId}-${imageType}`);
  }

  return null;
}

/**
 * Hydrate record images. Newer records already contain data URLs. Older seeded
 * records may contain relative or absolute file paths, so convert those to data
 * URLs before sending them to the renderer.
 */
function hydrateRecordImages(baseUploadDir, record, options) {
  if (!record || typeof record !== 'object') return record;
  const opts = options || {};
  const hydrated = { ...record };

  IMAGE_FIELD_TYPES.forEach(function (def) {
    const value = hydrated[def.dbField];
    if (value == null || String(value).trim() === '') return;
    if (isRenderableDataUrl(value)) return;

    const imagePath = resolveImagePath(baseUploadDir, hydrated, def.imageType, value);
    if (imagePath) {
      hydrated[def.dbField] = fileToDataUrl(imagePath);
    } else if (!opts.preserveUnresolved) {
      hydrated[def.dbField] = '';
    }
  });

  return hydrated;
}

module.exports = {
  getPersonnelId,
  ensureFolder,
  writeImageToDisk,
  archiveRecordImages,
  processRecordImages,
  hydrateRecordImages,
};