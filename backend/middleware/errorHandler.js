/**
 * Central error-handling middleware.
 * Must be registered LAST in Express middleware chain.
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Handle Multer upload errors
  if (err.name === 'MulterError') {
    statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'File size exceeds allowed limit (max 5MB).';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Unexpected file field.';
    }
  } else if (err.message && err.message.includes('Only image files')) {
    statusCode = 400;
  } else if (err.type === 'entity.parse.failed') {
    // Malformed JSON body
    statusCode = 400;
    message = 'Malformed JSON body in request.';
  }

  if (process.env.NODE_ENV === 'development') {
    console.error(`[ERROR] ${req.method} ${req.url} → ${statusCode}: ${message}`);
    if (err.stack && statusCode === 500) console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && statusCode === 500 && { stack: err.stack }),
  });
};

module.exports = errorHandler;
