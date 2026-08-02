// Lightweight, typed application error used for centralized error handling.
// Controllers/services throw ApiError; the global error handler in app.js
// knows how to translate it into the { success, message } response shape.
export default class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // distinguishes expected errors from bugs
    Error.captureStackTrace(this, this.constructor);
  }
}
