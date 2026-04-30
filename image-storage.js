const fs = require('fs');
const path = require('path');

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

  const match = String(base64DataUrl).match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) return null;

  const personnelId = getPersonnelId(record);
  if (!personnelId) return null;

  const [, format, base64Data] = match;
  const ext = format === 'jpeg' ? 'jpg' : format;
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

  const imageFields = [
    { dbField: 'photoDataUrl', imageType: 'IDPICTURE' },
    { dbField: 'signatureDataUrl', imageType: 'SIGNATURE' },
    { dbField: 'handwrittenEntryDataUrl', imageType: 'HANDWRITTENENTRY' },
    { dbField: 'leftThumbMarkDataUrl', imageType: 'LEFTTHUMB' },
    { dbField: 'rightThumbMarkDataUrl', imageType: 'RIGHTTHUMB' },
  ];

  imageFields.forEach(function (def) {
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
  // Images stay as data URLs; database stores them as-is
  return record;
}

/**
 * Hydrate record images: no-op - images are already data URLs from database
 */
function hydrateRecordImages(baseUploadDir, record) {
  // Images are already in data URL format from database
  return record;
}

module.exports = {
  getPersonnelId,
  ensureFolder,
  writeImageToDisk,
  archiveRecordImages,
  processRecordImages,
  hydrateRecordImages,
};
