const errorHandler = (err, req, res, next) => {
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const fieldErrors = Object.entries(err.errors).reduce((acc, [field, errorObj]) => {
      acc[field] = errorObj.message;
      return acc;
    }, {});

    return res.status(400).json({
      success: false,
      message: 'Validation failed.',
      errors: Object.values(fieldErrors),
      fieldErrors,
    });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      success: false,
      message: `Duplicate value for field: ${field}`,
      fieldErrors: {
        [field]: `Duplicate value for field: ${field}`
      }
    });
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: `Invalid value for ${err.path}: ${err.value}`,
      fieldErrors: {
        [err.path]: `Invalid value for ${err.path}`
      }
    });
  }

  console.error('Error:', err.message);
  console.error('Stack:', err.stack);

  // Default server error
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
};

module.exports = errorHandler;
