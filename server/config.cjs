const fs = require('node:fs')
const path = require('node:path')

function loadConfig(env = process.env) {
  const production = env.NODE_ENV === 'production'
  const required = name => {
    if (!env[name]) throw new Error('Missing configuration: ' + name)
    return env[name]
  }
  const secret = name => {
    const value = required(name)
    if (value.length < 32) throw new Error(name + ' must contain at least 32 characters')
    return value
  }
  const config = {
    production,
    databaseUrl: required('DATABASE_URL'),
    adminSecret: secret('ADMIN_SECRET'),
    userSecret: secret('USER_TOKEN_SECRET'),
    contactKey: secret('CONTACT_KEY'),
    phoneSalt: secret('PHONE_SALT'),
    adminInitPassword: env.ADMIN_INIT_PASSWORD || '',
    port: Number(env.PORT || 3001),
    host: env.HOST || '127.0.0.1',
    publicBaseUrl: required('PUBLIC_BASE_URL').replace(/\/$/, ''),
    origins: (env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174,http://localhost:5175').split(',').map(s => s.trim()).filter(Boolean),
    uploadDir: path.resolve(env.UPLOAD_DIR || path.join(__dirname, 'uploads')),
    devLoginKey: production ? '' : (env.DEV_LOGIN_KEY || '')
  }
  if (config.adminSecret === config.userSecret) throw new Error('Admin and user token secrets must differ')
  if (config.adminInitPassword && config.adminInitPassword.length < 12) throw new Error('ADMIN_INIT_PASSWORD requires 12 characters')
  if (config.devLoginKey && config.devLoginKey.length < 16) throw new Error('DEV_LOGIN_KEY requires 16 characters')
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) throw new Error('Invalid PORT')
  const base = new URL(config.publicBaseUrl)
  if (base.pathname !== '/api' || base.search || base.hash || base.username || base.password) throw new Error('PUBLIC_BASE_URL must be an origin followed by /api')
  if (!['http:', 'https:'].includes(base.protocol) || (production && base.protocol !== 'https:')) throw new Error('PUBLIC_BASE_URL requires HTTPS in production')
  if (config.origins.includes('*')) throw new Error('CORS_ORIGINS must list explicit origins')
  const pem = key => env[key] ? fs.readFileSync(env[key], 'utf8') : ''
  config.wechat = {
    appId: env.WX_APP_ID || '', appSecret: env.WX_APP_SECRET || '',
    mchId: env.WX_PAY_MCH_ID || '', merchantSerial: env.WX_PAY_MERCHANT_SERIAL || '',
    merchantPrivateKey: pem('WX_PAY_PRIVATE_KEY_PATH'), apiV3Key: env.WX_PAY_API_V3_KEY || '',
    platformCertificate: pem('WX_PAY_PLATFORM_CERT_PATH'),
    platformPublicKey: pem('WX_PAY_PLATFORM_PUBLIC_KEY_PATH'), platformSerial: env.WX_PAY_PLATFORM_SERIAL || '',
    notifyUrl: env.WX_PAY_NOTIFY_URL || '', allowedFileOrigins: [base.origin]
  }
  return config
}
module.exports = { loadConfig }
