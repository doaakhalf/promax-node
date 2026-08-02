// Wraps async route handlers so rejected promises are forwarded to
// Express's centralized error-handling middleware instead of requiring
// try/catch boilerplate in every controller.
export default function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
