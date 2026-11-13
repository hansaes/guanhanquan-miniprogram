'use strict'

// Adapted from fastify/fastify-cli templates/app/app.js; see THIRD_PARTY_NOTICES.md.
const path = require('node:path')
const AutoLoad = require('@fastify/autoload')

module.exports = async function (fastify, opts) {
  await fastify.register(require('@fastify/cors'), {
    origin: opts.config.origins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
  await fastify.register(require('@fastify/rate-limit'), { max: 180, timeWindow: '1 minute' })
  await fastify.register(require('@fastify/multipart'), {
    limits: { files: 1, fields: 1, fileSize: 5 * 1024 * 1024 }
  })
  fastify.removeContentTypeParser('application/json')
  fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    req.rawBody = body
    try { done(null, JSON.parse(body.toString('utf8'))) } catch (error) {
      error.statusCode = 400
      done(error)
    }
  })
  fastify.setErrorHandler((error, req, reply) => {
    const status = error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500
    if (status >= 500) req.log.error({ err: { name: error.name, code: error.code } }, 'request failed')
    reply.code(status).send({ success: false, code: status, message: status >= 500 ? '服务暂不可用，请稍后重试' : error.message, data: null })
  })
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'routes'),
    options: Object.assign({}, opts)
  })
}
