'use strict'
const { createHash, randomBytes, createCipheriv } = require('node:crypto')

/** @param {string} secret */
function createContactCipher(secret) {
  const key = createHash('sha256').update(secret).digest()
  /** @param {string} value */
  return function encrypt(value) {
    if (!value) return ''
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64')
  }
}

module.exports = { createContactCipher }
