const { sendError } = require('../utils/response');

function errorHandler(err, req, res, _next) {
  if (err.statusCode) {
    return sendError(res, err);
  }

  if (err.name === 'ZodError') {
    const issues = err.issues || err.errors || [];
    if (Array.isArray(issues)) {
      const details = issues.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return sendError(res, { statusCode: 422, code: 'VALIDATION_ERROR', message: 'One or more fields are invalid.', details });
    }
  }

  console.error('Unhandled error:', err);
  return sendError(res, { statusCode: 500, code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' });
}

module.exports = errorHandler;
