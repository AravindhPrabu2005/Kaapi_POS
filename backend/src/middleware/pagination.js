function parsePagination(req, _res, next) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.page_size, 10) || 20));
  req.pagination = { page, pageSize, offset: (page - 1) * pageSize };
  next();
}

module.exports = { parsePagination };
