/**
 * Build a square JPEG thumbnail (center crop) for roster / print consistency.
 * Avoids huge base64 in JSON and weird aspect ratios in tiny cells.
 */

/** @param {string} dataUrl */
export function squareThumbnailDataUrl(dataUrl, maxSide, jpegQuality) {
  maxSide = maxSide || 256;
  jpegQuality = jpegQuality == null ? 0.88 : jpegQuality;

  return new Promise(function (resolve, reject) {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) {
      reject(new Error('not an image data URL'));
      return;
    }

    var img = new Image();
    img.onload = function () {
      var w = img.naturalWidth;
      var h = img.naturalHeight;
      if (!w || !h) {
        reject(new Error('invalid dimensions'));
        return;
      }

      var minDim = Math.min(w, h);
      var sx = (w - minDim) / 2;
      var sy = (h - minDim) / 2;

      var canvas = document.createElement('canvas');
      canvas.width = maxSide;
      canvas.height = maxSide;
      var ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('no canvas context'));
        return;
      }

      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, maxSide, maxSide);

      try {
        resolve(canvas.toDataURL('image/jpeg', jpegQuality));
      } catch (e) {
        reject(e);
      }
    };

    img.onerror = function () {
      reject(new Error('image load failed'));
    };

    img.src = dataUrl;
  });
}
