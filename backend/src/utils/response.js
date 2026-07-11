function sendSuccess(res, data, meta = null, statusCode = 200) {
  return res.status(statusCode).json({ data, meta });
}

function sendPaginated(res, data, { page, pageSize, totalCount }) {
  const totalPages = Math.ceil(totalCount / pageSize);
  return res.status(200).json({
    data,
    meta: { page, page_size: pageSize, total_count: totalCount, total_pages: totalPages },
  });
}

function sendError(res, error) {
  const statusCode = error.statusCode || 500;
  const body = {
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || 'An unexpected error occurred.',
    },
  };
  if (error.details) body.error.details = error.details;
  return res.status(statusCode).json(body);
}

module.exports = { sendSuccess, sendPaginated, sendError };
