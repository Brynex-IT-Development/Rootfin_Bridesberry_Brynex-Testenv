/**
 * Image Upload Utility Functions
 * Handles validation, compression, and upload for all pages
 */

// Constants for image validation
export const IMAGE_CONFIG = {
  MAX_FILES: 15,
  MAX_FILE_SIZE: 30 * 1024 * 1024, // 30 MB before compression
  TARGET_FILE_SIZE: 1.5 * 1024 * 1024,
  MAX_OUTPUT_DIMENSION: 2200,
  MAX_DIMENSIONS: { width: 7000, height: 7000 },
  ACCEPTED_FORMATS: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
  ],
};

/**
 * Validate if file is an image and meets requirements
 * @param {File} file - File to validate
 * @returns {Object} - { valid: boolean, error: string | null }
 */
export const validateImageFile = (file) => {
  // Check file type
  if (!IMAGE_CONFIG.ACCEPTED_FORMATS.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file format. Accepted: ${IMAGE_CONFIG.ACCEPTED_FORMATS.map(f => f.split('/')[1]).join(', ').toUpperCase()}`,
    };
  }

  // Check file size
  if (file.size > IMAGE_CONFIG.MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds ${IMAGE_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB limit`,
    };
  }

  return { valid: true, error: null };
};

/**
 * Validate image dimensions
 * @param {File} file - Image file
 * @returns {Promise} - Promise resolving to { valid: boolean, error: string | null }
 */
export const validateImageDimensions = (file) => {
  return new Promise((resolve) => {
    if (file.type === 'image/heic' || file.type === 'image/heif') {
      resolve({ valid: true, error: null });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        if (img.width > IMAGE_CONFIG.MAX_DIMENSIONS.width || 
            img.height > IMAGE_CONFIG.MAX_DIMENSIONS.height) {
          resolve({
            valid: false,
            error: `Image dimensions exceed ${IMAGE_CONFIG.MAX_DIMENSIONS.width}x${IMAGE_CONFIG.MAX_DIMENSIONS.height}px`,
          });
        } else {
          resolve({ valid: true, error: null });
        }
      };
      img.onerror = () => {
        resolve({
          valid: false,
          error: 'Unable to read image dimensions',
        });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};

/**
 * Convert file to Base64
 * @param {File} file - File to convert
 * @returns {Promise<string>} - Base64 string with data URL prefix
 */
export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const canvasToBlob = (canvas, type, quality) =>
  new Promise((resolve) => canvas.toBlob(resolve, type, quality));

const compressImageFile = async (file) => {
  const originalSize = file.size;
  const base64 = await fileToBase64(file);
  const canCompress = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);

  if (!canCompress || file.size <= IMAGE_CONFIG.TARGET_FILE_SIZE) {
    return { base64, size: file.size, originalSize, compressed: false };
  }

  const image = await new Promise((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('Unable to decode image for compression'));
    element.src = base64;
  });

  const scale = Math.min(
    1,
    IMAGE_CONFIG.MAX_OUTPUT_DIMENSION / Math.max(image.width, image.height)
  );
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  let quality = 0.86;
  let blob = await canvasToBlob(canvas, 'image/webp', quality);
  while (blob && blob.size > IMAGE_CONFIG.TARGET_FILE_SIZE && quality > 0.45) {
    quality -= 0.08;
    blob = await canvasToBlob(canvas, 'image/webp', quality);
  }

  if (!blob || blob.size >= file.size) {
    return { base64, size: file.size, originalSize, compressed: false };
  }

  return {
    base64: await fileToBase64(blob),
    size: blob.size,
    originalSize,
    compressed: true,
  };
};

/**
 * Handle multiple file uploads with validation
 * @param {File[]} files - Array of files to upload
 * @returns {Promise<Array>} - Array of processed images { base64, name, size }
 */
export const processImageFiles = async (files) => {
  const results = [];
  const errors = [];

  for (let i = 0; i < Math.min(files.length, IMAGE_CONFIG.MAX_FILES); i++) {
    const file = files[i];

    // Validate file
    const validation = validateImageFile(file);
    if (!validation.valid) {
      errors.push(`${file.name}: ${validation.error}`);
      continue;
    }

    // Validate dimensions
    const dimensionValidation = await validateImageDimensions(file);
    if (!dimensionValidation.valid) {
      errors.push(`${file.name}: ${dimensionValidation.error}`);
      continue;
    }

    // Compress large browser-decodable images, then convert to base64.
    try {
      const processed = await compressImageFile(file);
      results.push({
        base64: processed.base64,
        name: file.name,
        size: processed.size,
        originalSize: processed.originalSize,
        compressed: processed.compressed,
        type: processed.compressed ? 'image/webp' : file.type,
      });
    } catch {
      errors.push(`${file.name}: Failed to process image`);
    }
  }

  return { images: results, errors };
};

/**
 * Handle drag and drop events
 * @param {DragEvent} event - Drag event
 * @returns {File[]} - Array of files from the drag event
 */
export const getFilesFromDragEvent = (event) => {
  const dt = event.dataTransfer;
  const files = [];

  for (let i = 0; i < dt.items.length; i++) {
    if (dt.items[i].kind === 'file') {
      const file = dt.items[i].getAsFile();
      if (file && file.type.startsWith('image/')) {
        files.push(file);
      }
    }
  }

  return files.length > 0 ? files : Array.from(dt.files);
};

/**
 * Get file input from click event on upload button
 * @param {string} elementSelector - CSS selector for the element triggering upload
 * @returns {void}
 */
export const triggerFileInput = (fileInputRef) => {
  if (fileInputRef?.current) {
    fileInputRef.current.click();
  }
};


