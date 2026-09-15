// ==========================================================================
// File Upload Middleware (Multer) — memory storage
// ==========================================================================
// Files are buffered in memory and handed to route handlers as
// req.file.buffer. Route handlers then insert the bytes into the
// `uploads` table and store "/uploads/<rowId>" in the DB.
//
// Nothing is written to disk, so uploads survive Render deploys.
//
// Max file size: 10 MB. Accepts images + documents.
// ==========================================================================

const multer = require('multer');
const path = require('path');

// ============================================
// 1. STORAGE — buffer in memory, no disk
// ============================================
const storage = multer.memoryStorage();

// ============================================
// 2. FILE FILTER
// ============================================
const fileFilter = (req, file, cb) => {
  const allowedExtensions =
    /\.(jpeg|jpg|png|gif|webp|pdf|doc|docx|txt|csv|xls|xlsx|ppt|pptx)$/i;

  const allowedMimetypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/octet-stream',
  ];

  const ext = path.extname(file.originalname).toLowerCase();
  const extnameValid = allowedExtensions.test(ext);
  const mimetypeValid = allowedMimetypes.includes(file.mimetype);

  console.log('📄 File upload check:', {
    originalname: file.originalname,
    extension: ext,
    mimetype: file.mimetype,
    extnameValid,
    mimetypeValid,
  });

  if (ext === '.pdf' && file.mimetype === 'application/octet-stream') {
    return cb(null, true);
  }

  if (extnameValid && mimetypeValid) {
    cb(null, true);
  } else {
    const errorMsg = `File type not allowed. Extension: ${ext || 'none'}, MIME type: ${file.mimetype || 'unknown'}.`;
    console.error('❌ File rejected:', errorMsg);
    cb(new Error(errorMsg));
  }
};

// ============================================
// 3. MULTER INSTANCE
// ============================================
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
    files: 10,
  },
});

// ============================================
// 4. ERROR WRAPPER
// ============================================
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const errorMap = {
      LIMIT_FILE_SIZE: `File too large. Maximum size is ${upload.limits.fileSize / 1024 / 1024}MB.`,
      LIMIT_FILE_COUNT: 'Too many files uploaded.',
      LIMIT_FIELD_KEY: 'Field name too long.',
      LIMIT_FIELD_VALUE: 'Field value too long.',
      LIMIT_FIELD_COUNT: 'Too many fields.',
      LIMIT_UNEXPECTED_FILE: 'Unexpected file field.',
    };
    const message = errorMap[err.code] || err.message;
    console.error('❌ Multer error:', err.code, message);
    return res.status(400).json({ error: message, code: err.code });
  } else if (err) {
    console.error('❌ Upload error:', err.message);
    return res.status(400).json({ error: err.message });
  }
  next();
};

// ============================================
// 5. HELPERS
// ============================================
const uploadSingle = (fieldName = 'file') => (req, res, next) =>
  upload.single(fieldName)(req, res, (err) => handleUploadError(err, req, res, next));

const uploadArray = (fieldName = 'files', maxCount = 10) => (req, res, next) =>
  upload.array(fieldName, maxCount)(req, res, (err) => handleUploadError(err, req, res, next));

const uploadFields = (fields) => (req, res, next) =>
  upload.fields(fields)(req, res, (err) => handleUploadError(err, req, res, next));

// ============================================
// 6. EXPORT
// ============================================
module.exports = {
  upload,
  uploadSingle,
  uploadArray,
  uploadFields,
  single: (field) => upload.single(field),
  array: (field, maxCount) => upload.array(field, maxCount),
  fields: (fields) => upload.fields(fields),
  any: () => upload.any(),
};