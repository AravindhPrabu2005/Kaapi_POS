function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const error = new Error('Validation failed');
      error.name = 'ZodError';
      error.errors = result.error.issues;
      return next(error);
    }
    req[source] = result.data;
    next();
  };
}

module.exports = { validate };
