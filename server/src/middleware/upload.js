// ==========================================================================
// File Upload Middleware (Multer)
// ==========================================================================
// Accepts images (jpeg, jpg, png, gif, webp) and documents (pdf, doc, docx).
// Files are saved to ../uploads/ with a unique timestamp-based filename.
// Max file size: 10 MB (increased from 5 MB for better usability).
// ==========================================================================

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ============================================
// 1. ENSURE UPLOADS DIRECTORY EXISTS
// ============================================
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`📁 Created uploads directory: ${uploadDir}`);
}

// ============================================
// 2. STORAGE CONFIGURATION
// ============================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Clean the original filename (remove special chars, spaces)
    const cleanName = file.originalname
      .replace(/[^a-zA-Z0-9.\-]/g, '_')
      .replace(/_+/g, '_');
    
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(cleanName);
    const baseName = path.basename(cleanName, ext);
    
    // Final filename: [timestamp]-[random]-[original_name].[ext]
    const finalName = `${uniqueSuffix}-${baseName}${ext}`;
    cb(null, finalName);
  },
});

// ============================================
// 3. FILE FILTER WITH BETTER MIME TYPE SUPPORT
// ============================================
const fileFilter = (req, file, cb) => {
  // Allowed extensions (case insensitive)
  const allowedExtensions = /\.(jpeg|jpg|png|gif|webp|pdf|doc|docx|txt|csv|xls|xlsx|ppt|pptx)$/i;
  
  // Allowed MIME types (comprehensive list)
  const allowedMimetypes = [
    // Images
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv',
    // Spreadsheets
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    // Presentations
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Generic binary
    'application/octet-stream', // Some systems send this for PDFs
  ];

  const ext = path.extname(file.originalname).toLowerCase();
  const extnameValid = allowedExtensions.test(ext);
  const mimetypeValid = allowedMimetypes.includes(file.mimetype);
  
  // Log for debugging
  console.log(`📄 File upload check:`, {
    originalname: file.originalname,
    extension: ext,
    mimetype: file.mimetype,
    extnameValid,
    mimetypeValid,
    size: file.size || 'unknown'
  });

  // Special handling for PDFs that sometimes have wrong MIME type
  if (ext === '.pdf' && file.mimetype === 'application/octet-stream') {
    console.log('📄 PDF detected with application/octet-stream MIME type - allowing');
    return cb(null, true);
  }

  if (extnameValid && mimetypeValid) {
    cb(null, true);
  } else {
    const errorMsg = `File type not allowed. Extension: ${ext || 'none'}, MIME type: ${file.mimetype || 'unknown'}. Allowed: images (JPG, PNG, GIF, WebP) and documents (PDF, DOC, DOCX, TXT, CSV).`;
    console.error('❌ File rejected:', errorMsg);
    cb(new Error(errorMsg));
  }
};

// ============================================
// 4. MULTER INSTANCE
// ============================================
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB (increased from 5MB)
    files: 10, // Max 10 files per request
  },
});

// ============================================
// 5. ERROR HANDLING WRAPPER
// ============================================
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // Multer-specific errors
    const errorMap = {
      'LIMIT_FILE_SIZE': `File too large. Maximum size is ${upload.limits.fileSize / 1024 / 1024}MB.`,
      'LIMIT_FILE_COUNT': 'Too many files uploaded.',
      'LIMIT_FIELD_KEY': 'Field name too long.',
      'LIMIT_FIELD_VALUE': 'Field value too long.',
      'LIMIT_FIELD_COUNT': 'Too many fields.',
      'LIMIT_UNEXPECTED_FILE': 'Unexpected file field.',
    };
    
    const message = errorMap[err.code] || err.message;
    console.error('❌ Multer error:', err.code, message);
    return res.status(400).json({ 
      error: message,
      code: err.code 
    });
  } else if (err) {
    // Other errors (like file filter)
    console.error('❌ Upload error:', err.message);
    return res.status(400).json({ 
      error: err.message 
    });
  }
  next();
};

// ============================================
// 6. HELPER FUNCTIONS FOR DIFFERENT FIELD NAMES
// ============================================

// For single file upload with any field name
const uploadSingle = (fieldName = 'file') => {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      handleUploadError(err, req, res, next);
    });
  };
};

// For multiple files with same field name
const uploadArray = (fieldName = 'files', maxCount = 10) => {
  return (req, res, next) => {
    upload.array(fieldName, maxCount)(req, res, (err) => {
      handleUploadError(err, req, res, next);
    });
  };
};

// For multiple files with different field names
const uploadFields = (fields) => {
  return (req, res, next) => {
    upload.fields(fields)(req, res, (err) => {
      handleUploadError(err, req, res, next);
    });
  };
};

// ============================================
// 7. EXPORT
// ============================================
module.exports = {
  upload,
  uploadSingle,
  uploadArray,
  uploadFields,
  // For backward compatibility
  single: (field) => upload.single(field),
  array: (field, maxCount) => upload.array(field, maxCount),
  fields: (fields) => upload.fields(fields),
  any: () => upload.any(),
};