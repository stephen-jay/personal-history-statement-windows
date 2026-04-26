const fs = require('fs');
const path = require('path');

/**
 * Image storage utility for managing personnel image files
 * Organizes images by person in folders with standardized naming
 */

/**
 * Generate person folder name: LastName FirstName MiddleName
 */
function getPersonFolderName(record) {
  const lastName = (record.nameLast || '').trim();
  const firstName = (record.nameFirst || '').trim();
  const middleName = (record.nameMiddle || '').trim();

  const parts = [lastName, firstName, middleName].filter(Boolean);
  if (!parts.length) return null;

  return parts.join(' ');
}

/**
 * Get initials for filename: FirstNameInitial + MiddleNameInitial
 * Example: Carlos Torres Dela Cruz → CT
 */
function getPersonInitials(record) {
  const firstName = (record.nameFirst || '').trim();
  const middleName = (record.nameMiddle || '').trim();

  const initials = [];
  if (firstName) initials.push(firstName.charAt(0).toUpperCase());
  if (middleName) initials.push(middleName.charAt(0).toUpperCase());

  return initials.join('');
}

/**
 * Get last name without spaces for filename
 * Example: Dela Cruz → DelaCruz
 */
function getLastNameNoSpaces(record) {
  const lastName = (record.nameLast || '').trim();
  return lastName.replace(/\s+/g, '');
}

/**
 * Generate filename for an image
 * Format: LastNameNoSpaces + Initials + - + ImageType
 * Example: DelaCruzCT-LeftThumb.png
 */
function generateImageFilename(record, imageType) {
  const lastNameNoSpaces = getLastNameNoSpaces(record);
  const initials = getPersonInitials(record);

  if (!lastNameNoSpaces) {
    throw new Error('Cannot generate filename: person must have nameLast');
  }

  // The user requested LastNameInitials-ImageType
  // Example: DelaCruzCT-LeftThumb
  return `${lastNameNoSpaces}${initials}-${imageType}`;
}

/**
 * Ensure person folder exists
 */
function ensurePersonFolder(baseUploadDir, record) {
  const folderName = getPersonFolderName(record);
  if (!folderName) throw new Error('Cannot create folder: person must have a nameLast');

  const personDir = path.join(baseUploadDir, folderName);
  if (!fs.existsSync(personDir)) {
    fs.mkdirSync(personDir, { recursive: true });
  }

  return personDir;
}

/**
 * Save base64 image to disk
 * Returns relative path for storage in database
 */
function saveImageToDisk(baseUploadDir, record, imageType, base64DataUrl) {
  if (!base64DataUrl) return null;

  try {
    const personDir = ensurePersonFolder(baseUploadDir, record);
    const filename = generateImageFilename(record, imageType);

    // Extract image data and format from data URL
    const match = base64DataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!match) {
      console.warn(`Invalid data URL for ${imageType}, skipping`);
      return null;
    }

    const [, format, base64Data] = match;
    const filenameWithExt = `${filename}.${format === 'jpeg' ? 'jpg' : format}`;
    const filePath = path.join(personDir, filenameWithExt);

    // Write image file
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);

    // Return relative path for database storage
    return path.relative(baseUploadDir, filePath).replace(/\\/g, '/');
  } catch (e) {
    console.error(`Failed to save ${imageType}:`, e);
    return null;
  }
}

/**
 * Read image from disk and convert to base64 data URL
 */
function loadImageFromDisk(baseUploadDir, imagePath) {
  if (!imagePath) return null;

  try {
    const fullPath = path.join(baseUploadDir, imagePath);
    if (!fs.existsSync(fullPath)) {
      // Don't warn here, might be a valid path but file missing
      return null;
    }

    const data = fs.readFileSync(fullPath);
    const ext = path.extname(imagePath).substring(1).toLowerCase();
    const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;

    return `data:${mimeType};base64,${data.toString('base64')}`;
  } catch (e) {
    console.error(`Failed to load image from ${imagePath}:`, e);
    return null;
  }
}

/**
 * Process record images: convert base64 to files on disk
 * Modifies record in-place, replacing data URLs with file paths
 */
function processRecordImages(baseUploadDir, record) {
  if (!record) return record;

  const imageFields = [
    { dbField: 'leftThumbMarkDataUrl', imageType: 'LeftThumb' },
    { dbField: 'rightThumbMarkDataUrl', imageType: 'RightThumb' },
    { dbField: 'handwrittenEntryDataUrl', imageType: 'HandwrittenEntry' },
    { dbField: 'signatureDataUrl', imageType: 'Signature' },
    { dbField: 'photoDataUrl', imageType: 'IDPicture' },
  ];

  imageFields.forEach(({ dbField, imageType }) => {
    if (record[dbField]) {
      const value = record[dbField];

      // If it's a data URL, save to disk and get file path
      if (typeof value === 'string' && value.startsWith('data:')) {
        const filePath = saveImageToDisk(baseUploadDir, record, imageType, value);
        if (filePath) {
          record[dbField] = filePath;
        }
      }
      // If it's already a path, leave it as-is (already migrated)
    }
  });

  return record;
}

/**
 * Hydrate record images: convert file paths to data URLs for display
 * Returns new record object with data URLs
 */
function hydrateRecordImages(baseUploadDir, record) {
  if (!record) return record;

  const hydrated = { ...record };
  const imageFields = [
    'leftThumbMarkDataUrl',
    'rightThumbMarkDataUrl',
    'handwrittenEntryDataUrl',
    'signatureDataUrl',
    'photoDataUrl',
  ];

  imageFields.forEach((field) => {
    if (hydrated[field]) {
      const value = hydrated[field];
      // If it's a path (not a data URL), load from disk
      if (typeof value === 'string' && !value.startsWith('data:')) {
        const dataUrl = loadImageFromDisk(baseUploadDir, value);
        if (dataUrl) {
          hydrated[field] = dataUrl;
        }
      }
    }
  });

  return hydrated;
}

module.exports = {
  getPersonFolderName,
  getPersonInitials,
  getLastNameNoSpaces,
  generateImageFilename,
  ensurePersonFolder,
  saveImageToDisk,
  loadImageFromDisk,
  processRecordImages,
  hydrateRecordImages,
};
