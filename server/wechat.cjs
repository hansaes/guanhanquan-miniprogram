'use strict'

const crypto = require('node:crypto')

const API_ORIGIN = 'https://api.weixin.qq.com'
const PAY_ORIGIN = 'https://api.mch.weixin.qq.com'
const MAX_BODY_BYTES = 1024 * 1024
const MAX_SIGNATURE_AGE_SECONDS = 300

function failure(statusCode, message, code = 'WECHAT_ERROR') {
  return Object.assign(new Error(message), { statusCode, code })
}

function nonempty(value, max = 256) {
  return typeof value === 'string' && value.length > 0 && value.length <= max
}

function header(headers, name) {
  const value = typeof headers?.get === 'function'
    ? headers.get(name)
    : Object.entries(headers || {}).find(([key]) => key.toLowerCase() === name)?.[1]
  return typeof value === 'string' ? value : ''
}

function parseJson(text, statusCode = 502) {
  try {
    if (Buffer.byteLength(text) > MAX_BODY_BYTES) throw new Error('too large')
    const value = JSON.parse(text)
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('not object')
    return value
  } catch {
    throw failure(statusCode, '微信返回的数据格式不正确')
  }
}

function requireConfig(config, names, feature) {
  if (names.some((name) => !nonempty(config[name], 32768))) {
    throw failure(503, `${feature}未配置，请联系管理员`, 'WECHAT_NOT_CONFIGURED')
  }
}

/**
 * Real WeChat server API gateway. Secrets are supplied by the server config,
 * never obtained from client requests or returned in the session result.
 *
 * Payment protocol references:
 * https://pay.weixin.qq.com/doc/v3/merchant/4012791856
 * https://pay.weixin.qq.com/doc/v3/merchant/4012365352
 * https://pay.weixin.qq.com/doc/v3/merchant/4012071382
 */
function createWechat(config = {}, dependencies = {}) {
  const cfg = { ...config }
  const fetchImpl = dependencies.fetch || globalThis.fetch
  const now = dependencies.now || Date.now
  const randomBytes = dependencies.randomBytes || crypto.randomBytes
  let cachedToken
  let tokenRequest
  let merchantKey
  let platformKey
  let certificate
  let platformSerial
  const allowedFileOrigins = new Set((cfg.allowedFileOrigins || []).map((value) => {
    try {
      const url = new URL(value)
      return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.origin : ''
    } catch { return '' }
  }).filter(Boolean))

  async function request(url, options = {}) {
    try {
      const response = await fetchImpl(url, {
        ...options,
        redirect: 'error',
        signal: AbortSignal.timeout(10000)
      })
      return { response, text: await response.text() }
    } catch {
      // Fetch exceptions can contain URLs with app secrets or access tokens.
      throw failure(502, '暂时无法连接微信服务，请稍后重试', 'WECHAT_UNAVAILABLE')
    }
  }

  async function requestJson(url, options) {
    const result = await request(url, options)
    const body = parseJson(result.text)
    if (!result.response.ok) throw failure(502, '微信服务请求失败')
    if (body.errcode) {
      const code = Number(body.errcode)
      const isInvalidCode = [40029, 40163].includes(code)
      throw Object.assign(failure(isInvalidCode ? 400 : 502,
        isInvalidCode ? '微信授权凭证已失效，请重新授权' : `微信服务调用失败（${Number.isFinite(code) ? code : '未知错误'}）`),
      { wechatCode: code })
    }
    return body
  }

  async function exchangeCode(code) {
    requireConfig(cfg, ['appId', 'appSecret'], '微信登录')
    if (!nonempty(code, 512)) throw failure(400, '缺少有效的微信登录凭证')
    const query = new URLSearchParams({
      appid: cfg.appId, secret: cfg.appSecret, js_code: code, grant_type: 'authorization_code'
    })
    const data = await requestJson(`${API_ORIGIN}/sns/jscode2session?${query}`)
    if (!nonempty(data.openid, 128)) throw failure(502, '微信登录未返回用户标识')
    return { openid: data.openid, ...(nonempty(data.unionid, 128) ? { unionid: data.unionid } : {}) }
  }

  async function accessToken() {
    requireConfig(cfg, ['appId', 'appSecret'], '微信手机号服务')
    if (cachedToken && cachedToken.expiresAt > now()) return cachedToken.value
    if (!tokenRequest) {
      tokenRequest = (async () => {
        const data = await requestJson(`${API_ORIGIN}/cgi-bin/stable_token`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ grant_type: 'client_credential', appid: cfg.appId,
            secret: cfg.appSecret, force_refresh: false })
        })
        if (!nonempty(data.access_token, 4096) || !Number.isFinite(data.expires_in) || data.expires_in <= 0) {
          throw failure(502, '微信未返回有效的接口凭据')
        }
        cachedToken = { value: data.access_token, expiresAt: now() + Math.max(0, data.expires_in - 60) * 1000 }
        return cachedToken.value
      })().finally(() => { tokenRequest = undefined })
    }
    return tokenRequest
  }

  async function getPhoneNumber({ code } = {}) {
    requireConfig(cfg, ['appId', 'appSecret'], '微信手机号服务')
    if (!nonempty(code, 512)) throw failure(400, '缺少有效的手机号授权凭证')
    let data
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await accessToken()
      try {
        data = await requestJson(`${API_ORIGIN}/wxa/business/getuserphonenumber?access_token=${encodeURIComponent(token)}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code })
        })
        break
      } catch (error) {
        if (attempt === 0 && [40001, 40014, 42001].includes(error.wechatCode)) cachedToken = undefined
        else throw error
      }
    }
    const info = data.phone_info
    if (!info || !nonempty(info.purePhoneNumber, 32) || !/^\d{5,20}$/.test(info.purePhoneNumber)) {
      throw failure(502, '微信未返回有效的手机号码')
    }
    if (info.watermark?.appid && info.watermark.appid !== cfg.appId) {
      throw failure(502, '手机号授权的小程序不匹配')
    }
    return { phoneInfo: { purePhoneNumber: info.purePhoneNumber,
      phoneNumber: info.phoneNumber, countryCode: info.countryCode } }
  }

  function loadPlatformKey() {
    if (!platformKey) {
      try {
        if (cfg.platformCertificate) {
          certificate = new crypto.X509Certificate(cfg.platformCertificate)
          platformKey = certificate.publicKey
          platformSerial = certificate.serialNumber.replace(/:/g, '').toUpperCase()
          if (cfg.platformSerial && cfg.platformSerial.replace(/:/g, '').toUpperCase() !== platformSerial) {
            throw new Error('serial mismatch')
          }
        } else {
          requireConfig(cfg, ['platformPublicKey', 'platformSerial'], '微信支付验签密钥')
          platformKey = crypto.createPublicKey(cfg.platformPublicKey)
          platformSerial = cfg.platformSerial.toUpperCase()
        }
        if (platformKey.asymmetricKeyType !== 'rsa' || platformKey.asymmetricKeyDetails.modulusLength < 2048) {
          throw new Error('not RSA 2048')
        }
      } catch {
        platformKey = undefined
        throw failure(503, '微信支付验签密钥未配置或无效', 'WECHAT_NOT_CONFIGURED')
      }
    }
    if (certificate && (now() < Date.parse(certificate.validFrom) || now() > Date.parse(certificate.validTo))) {
      throw failure(503, '微信支付平台证书已过期或尚未生效', 'WECHAT_NOT_CONFIGURED')
    }
    return platformKey
  }

  function verifySignature(headers, rawBody) {
    const key = loadPlatformKey()
    const timestamp = header(headers, 'wechatpay-timestamp')
    const nonce = header(headers, 'wechatpay-nonce')
    const signature = header(headers, 'wechatpay-signature')
    const serial = header(headers, 'wechatpay-serial')
    if (!/^\d{10,12}$/.test(timestamp) || Math.abs(Math.floor(now() / 1000) - Number(timestamp)) > MAX_SIGNATURE_AGE_SECONDS ||
      !nonempty(nonce) || !nonempty(signature, 1024) || !/^[A-Za-z0-9+/]+={0,2}$/.test(signature) ||
      serial.replace(/:/g, '').toUpperCase() !== platformSerial ||
      !(typeof rawBody === 'string' || Buffer.isBuffer(rawBody)) || Buffer.byteLength(rawBody) > MAX_BODY_BYTES) {
      throw failure(401, '微信支付签名校验失败', 'WECHAT_INVALID_SIGNATURE')
    }
    const message = Buffer.concat([Buffer.from(`${timestamp}\n${nonce}\n`), Buffer.from(rawBody), Buffer.from('\n')])
    if (!crypto.verify('RSA-SHA256', message, key, Buffer.from(signature, 'base64'))) {
      throw failure(401, '微信支付签名校验失败', 'WECHAT_INVALID_SIGNATURE')
    }
  }

  function paymentConfig() {
    requireConfig(cfg, ['appId', 'mchId', 'merchantSerial', 'merchantPrivateKey', 'apiV3Key', 'notifyUrl'], '微信支付')
    if (Buffer.byteLength(cfg.apiV3Key) !== 32 || !/^[A-Za-z0-9]+$/.test(cfg.merchantSerial) || !/^\d+$/.test(cfg.mchId)) {
      throw failure(503, '微信支付商户配置无效', 'WECHAT_NOT_CONFIGURED')
    }
    try {
      const notify = new URL(cfg.notifyUrl)
      if (notify.protocol !== 'https:' || notify.username || notify.password || notify.hash) throw new Error('invalid callback URL')
      if (!merchantKey) merchantKey = crypto.createPrivateKey(cfg.merchantPrivateKey)
      if (merchantKey.asymmetricKeyType !== 'rsa' || merchantKey.asymmetricKeyDetails.modulusLength < 2048) throw new Error('not RSA 2048')
    } catch {
      throw failure(503, '微信支付私钥或回调地址无效', 'WECHAT_NOT_CONFIGURED')
    }
    loadPlatformKey()
  }

  async function unifiedOrder(openid, options = {}) {
    paymentConfig()
    if (!nonempty(openid, 128)) throw failure(401, '请先登录后充值')
    if (!Number.isSafeInteger(options.totalFee) || options.totalFee <= 0 ||
      !nonempty(options.outTradeNo, 32) || !/^[A-Za-z0-9_-]+$/.test(options.outTradeNo) ||
      !nonempty(options.body, 127) || Buffer.byteLength(options.body) > 127 ||
      (options.tradeType && options.tradeType !== 'JSAPI')) {
      throw failure(400, '微信支付订单参数不合法')
    }
    if (options.subMchId && String(options.subMchId) !== cfg.mchId) {
      throw failure(503, '充值商户号与服务器微信支付配置不一致', 'WECHAT_NOT_CONFIGURED')
    }
    const path = '/v3/pay/transactions/jsapi'
    const body = JSON.stringify({
      appid: cfg.appId, mchid: cfg.mchId, description: options.body,
      out_trade_no: options.outTradeNo, notify_url: cfg.notifyUrl,
      amount: { total: options.totalFee, currency: 'CNY' }, payer: { openid }
    })
    const timestamp = String(Math.floor(now() / 1000))
    const nonce = randomBytes(16).toString('hex')
    const signature = crypto.sign('RSA-SHA256', Buffer.from(`POST\n${path}\n${timestamp}\n${nonce}\n${body}\n`), merchantKey).toString('base64')
    const result = await request(`${PAY_ORIGIN}${path}`, {
      method: 'POST', body,
      headers: {
        'Content-Type': 'application/json', Accept: 'application/json',
        Authorization: `WECHATPAY2-SHA256-RSA2048 mchid="${cfg.mchId}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${cfg.merchantSerial}",signature="${signature}"`
      }
    })
    try { verifySignature(result.response.headers, result.text) } catch (error) {
      if (error.statusCode === 503) throw error
      throw failure(502, '微信支付响应签名校验失败', 'WECHAT_INVALID_RESPONSE')
    }
    const data = parseJson(result.text)
    if (!result.response.ok || !nonempty(data.prepay_id, 256)) throw failure(502, '微信支付下单失败，请稍后重试')
    const payment = {
      timeStamp: String(Math.floor(now() / 1000)), nonceStr: randomBytes(16).toString('hex'),
      package: `prepay_id=${data.prepay_id}`, signType: 'RSA'
    }
    payment.paySign = crypto.sign('RSA-SHA256', Buffer.from(`${cfg.appId}\n${payment.timeStamp}\n${payment.nonceStr}\n${payment.package}\n`), merchantKey).toString('base64')
    return { returnCode: 'SUCCESS', resultCode: 'SUCCESS', payment }
  }

  function verifyAndDecryptPayment({ headers, rawBody } = {}) {
    requireConfig(cfg, ['appId', 'mchId', 'apiV3Key'], '微信支付通知')
    if (Buffer.byteLength(cfg.apiV3Key) !== 32) throw failure(503, '微信支付 APIv3 密钥无效', 'WECHAT_NOT_CONFIGURED')
    verifySignature(headers, rawBody)
    const event = parseJson(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody, 400)
    const resource = event.resource
    if (event.event_type !== 'TRANSACTION.SUCCESS' || event.resource_type !== 'encrypt-resource' ||
      resource?.original_type !== 'transaction' || resource.algorithm !== 'AEAD_AES_256_GCM' ||
      !nonempty(resource.nonce, 16) || Buffer.byteLength(resource.nonce) !== 12 ||
      !nonempty(resource.ciphertext, MAX_BODY_BYTES) ||
      (resource.associated_data !== undefined && typeof resource.associated_data !== 'string')) {
      throw failure(400, '微信支付通知类型或格式不正确')
    }
    let transaction
    try {
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(resource.ciphertext)) throw new Error('invalid base64')
      const ciphertext = Buffer.from(resource.ciphertext, 'base64')
      if (ciphertext.length <= 16) throw new Error('invalid ciphertext')
      const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(cfg.apiV3Key), Buffer.from(resource.nonce))
      decipher.setAuthTag(ciphertext.subarray(-16))
      decipher.setAAD(Buffer.from(resource.associated_data || ''))
      const plaintext = Buffer.concat([decipher.update(ciphertext.subarray(0, -16)), decipher.final()])
      transaction = parseJson(plaintext.toString('utf8'), 400)
    } catch {
      throw failure(400, '微信支付通知解密失败')
    }
    if (transaction.appid !== cfg.appId || transaction.mchid !== cfg.mchId ||
      transaction.trade_state !== 'SUCCESS' || transaction.trade_type !== 'JSAPI' ||
      !nonempty(transaction.out_trade_no, 32) || !nonempty(transaction.transaction_id, 64) ||
      !nonempty(transaction.payer?.openid, 128) || !Number.isSafeInteger(transaction.amount?.total) ||
      transaction.amount.total <= 0 || transaction.amount.currency !== 'CNY') {
      throw failure(400, '微信支付通知的商户、订单或金额不匹配')
    }
    // The caller must compare these fields to the stored order and settle once
    // in a DB transaction. A valid notification is not itself an account credit.
    return { outTradeNo: transaction.out_trade_no, totalFee: transaction.amount.total,
      transactionId: transaction.transaction_id, openid: transaction.payer.openid }
  }

  function cloudFor(openid) {
    return {
      openapi: { phonenumber: { getPhoneNumber } },
      cloudPay: { unifiedOrder: (options) => unifiedOrder(openid, options) },
      async getTempFileURL({ fileList = [] } = {}) {
        return { fileList: fileList.filter((file) => {
          if (typeof file !== 'string') return false
          try {
            const url = new URL(file)
            return /^https?:$/.test(url.protocol) && !url.username && !url.password && allowedFileOrigins.has(url.origin)
          } catch { return false }
        }).map((fileID) => ({ fileID, tempFileURL: fileID, status: 0 })) }
      }
    }
  }

  return { exchangeCode, cloudFor, verifyAndDecryptPayment }
}

module.exports = { createWechat }
