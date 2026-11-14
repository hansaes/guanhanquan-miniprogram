'use strict'

class ApplicationError extends Error {
  /** @param {number} statusCode @param {string} code @param {string} message */
  constructor(statusCode, code, message) {
    super(message)
    this.name = 'ApplicationError'
    this.statusCode = statusCode
    this.code = code
  }
}

/** @param {unknown} condition @param {number} status @param {string} code @param {string} message */
function requireCondition(condition, status, code, message) {
  if (!condition) throw new ApplicationError(status, code, message)
}

module.exports = { ApplicationError, requireCondition }
