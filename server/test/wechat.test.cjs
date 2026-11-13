'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { createWechat } = require('../wechat.cjs')

// All credentials in these tests are generated fixtures; no live services or
// merchant credentials are used.
const merchant = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
const platform = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
const instant = Date.UTC(2026, 10, 13, 12)
const config = {
  appId: 'wx-test-app', appSecret: 'test-only-app-secret', mchId: '1900000001',
  merchantSerial: '1234ABCDEF',
  merchantPrivateKey: merchant.privateKey.export({ format: 'pem', type: 'pkcs8' }),
  platformPublicKey: platform.publicKey.export({ format: 'pem', type: 'spki' }),
  platformSerial: 'PUB_KEY_ID_TEST', apiV3Key: '0123456789abcdef0123456789abcdef',
  notifyUrl: 'https://api.example.test/api/pay/notify'
}
const now = () => instant
const response = (body, status = 200) => new Response(JSON.stringify(body), { status })
const noFetch = async () => { throw new Error('Unexpected network request') }

function signed(rawBody, overrides = {}) {
  const timestamp = overrides.timestamp || String(Math.floor(instant / 1000))
  const nonce = 'signature-nonce'
  const signature = crypto.sign('RSA-SHA256', Buffer.from(`${timestamp}\n${nonce}\n${rawBody}\n`), platform.privateKey).toString('base64')
  return { 'Wechatpay-Timestamp': timestamp, 'Wechatpay-Nonce': nonce,
    'Wechatpay-Signature': signature, 'Wechatpay-Serial': config.platformSerial }
}

function paymentNotification(transactionPatch = {}, eventPatch = {}) {
  const transaction = {
    appid: config.appId, mchid: config.mchId,
    trade_state: 'SUCCESS', trade_type: 'JSAPI', out_trade_no: 'GHQ20261113001',
    transaction_id: '420000012345678', payer: { openid: 'buyer-openid' },
    amount: { total: 1234, currency: 'CNY', payer_total: 1200 }, ...transactionPatch
  }
  const resourceNonce = '0123456789ab'
  const associatedData = 'transaction'
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(config.apiV3Key), Buffer.from(resourceNonce))
  cipher.setAAD(Buffer.from(associatedData))
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(transaction)), cipher.final(), cipher.getAuthTag()])
  const rawBody = JSON.stringify({
    id: 'event-1', event_type: 'TRANSACTION.SUCCESS', resource_type: 'encrypt-resource',
    resource: { original_type: 'transaction', algorithm: 'AEAD_AES_256_GCM',
      nonce: resourceNonce, associated_data: associatedData, ciphertext: ciphertext.toString('base64') },
    ...eventPatch
  })
  return { rawBody, headers: signed(rawBody) }
}

test('unconfigured integrations fail with 503 and never report successful payment', async () => {
  const gateway = createWechat({}, { fetch: noFetch, now })
  await assert.rejects(gateway.exchangeCode('code'), { statusCode: 503 })
  await assert.rejects(gateway.cloudFor('buyer').openapi.phonenumber.getPhoneNumber({ code: 'code' }), { statusCode: 503 })
  await assert.rejects(gateway.cloudFor('buyer').cloudPay.unifiedOrder({}), { statusCode: 503 })
  assert.throws(() => gateway.verifyAndDecryptPayment(paymentNotification()), { statusCode: 503 })
})

test('login exchanges a server code, returns identity and never returns session_key', async () => {
  const gateway = createWechat(config, { now, fetch: async (url, options) => {
    const parsed = new URL(url)
    assert.equal(parsed.origin, 'https://api.weixin.qq.com')
    assert.equal(parsed.pathname, '/sns/jscode2session')
    assert.equal(parsed.searchParams.get('appid'), config.appId)
    assert.equal(parsed.searchParams.get('secret'), config.appSecret)
    assert.equal(parsed.searchParams.get('js_code'), 'encoded+code&value')
    assert.equal(parsed.searchParams.get('grant_type'), 'authorization_code')
    assert.equal(options.redirect, 'error')
    return response({ openid: 'openid-1', unionid: 'unionid-1', session_key: 'must-stay-private' })
  } })
  assert.deepEqual(await gateway.exchangeCode('encoded+code&value'), { openid: 'openid-1', unionid: 'unionid-1' })
})

test('invalid login credentials fail without echoing upstream secrets or error messages', async () => {
  const gateway = createWechat(config, { now, fetch: async () => response({ errcode: 40029, errmsg: config.appSecret }) })
  await assert.rejects(gateway.exchangeCode('bad-code'), (error) => {
    assert.equal(error.statusCode, 400)
    assert.ok(!error.message.includes(config.appSecret))
    return true
  })
  await assert.rejects(gateway.exchangeCode({ openid: 'forged' }), { statusCode: 400 })
  const offline = createWechat(config, { fetch: async () => { throw new Error(config.appSecret) } })
  await assert.rejects(offline.exchangeCode('code'), (error) => error.statusCode === 502 && !error.message.includes(config.appSecret))
})

test('phone exchange shares a cached access token across concurrent requests', async () => {
  let tokenCalls = 0
  let phoneCalls = 0
  const gateway = createWechat(config, { now, fetch: async (url, options) => {
    const body = JSON.parse(options.body)
    if (url.endsWith('/cgi-bin/stable_token')) {
      tokenCalls++
      assert.equal(body.appid, config.appId)
      assert.equal(body.force_refresh, false)
      return response({ access_token: 'token&value', expires_in: 7200 })
    }
    phoneCalls++
    assert.equal(new URL(url).searchParams.get('access_token'), 'token&value')
    assert.equal(body.code, 'phone-code')
    return response({ errcode: 0, phone_info: { purePhoneNumber: '13800138000', phoneNumber: '8613800138000',
      countryCode: '86', watermark: { appid: config.appId } } })
  } })
  const phone = gateway.cloudFor('buyer').openapi.phonenumber
  const results = await Promise.all([phone.getPhoneNumber({ code: 'phone-code' }), phone.getPhoneNumber({ code: 'phone-code' })])
  assert.equal(tokenCalls, 1)
  assert.equal(phoneCalls, 2)
  assert.equal(results[0].phoneInfo.purePhoneNumber, '13800138000')
})

test('expired access token is refreshed once and invalid app watermark is rejected', async () => {
  let tokens = 0
  const gateway = createWechat(config, { now, fetch: async (url) => {
    if (url.endsWith('/cgi-bin/stable_token')) return response({ access_token: `token-${++tokens}`, expires_in: 7200 })
    if (new URL(url).searchParams.get('access_token') === 'token-1') return response({ errcode: 42001 })
    return response({ phone_info: { purePhoneNumber: '13800138000', watermark: { appid: 'another-app' } } })
  } })
  await assert.rejects(gateway.cloudFor('buyer').openapi.phonenumber.getPhoneNumber({ code: 'phone-code' }), { statusCode: 502 })
  assert.equal(tokens, 2)
})

test('file URLs are returned only for explicitly configured HTTP origins', async () => {
  const gateway = createWechat({ allowedFileOrigins: ['https://files.example.test'] }, { fetch: noFetch })
  const fileList = ['https://files.example.test/image.jpg', 'https://files.example.test.evil.test/a',
    'https://user:password@files.example.test/a', 'cloud://old-file', 'javascript:alert(1)', 'http://files.example.test/a',
    'https://other.example.test/a', { fileID: 'unexpected' }]
  assert.deepEqual(await gateway.cloudFor('buyer').getTempFileURL({ fileList }), {
    fileList: [{ fileID: fileList[0], tempFileURL: fileList[0], status: 0 }]
  })
  assert.deepEqual(await createWechat().cloudFor().getTempFileURL({ fileList }), { fileList: [] })
})

test('JSAPI prepay signs the exact request and client payment with the merchant key', async () => {
  const gateway = createWechat(config, { now, fetch: async (url, options) => {
    assert.equal(url, 'https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi')
    const auth = Object.fromEntries([...options.headers.Authorization.matchAll(/(\w+)="([^"]*)"/g)].map((match) => [match[1], match[2]]))
    assert.equal(auth.mchid, config.mchId)
    assert.equal(auth.serial_no, config.merchantSerial)
    assert.equal(crypto.verify('RSA-SHA256', Buffer.from(`POST\n/v3/pay/transactions/jsapi\n${auth.timestamp}\n${auth.nonce_str}\n${options.body}\n`),
      merchant.publicKey, Buffer.from(auth.signature, 'base64')), true)
    assert.deepEqual(JSON.parse(options.body), {
      appid: config.appId, mchid: config.mchId, description: '余额充值', out_trade_no: 'GHQ12345',
      notify_url: config.notifyUrl, amount: { total: 1234, currency: 'CNY' }, payer: { openid: 'buyer-openid' }
    })
    const text = JSON.stringify({ prepay_id: 'wx-real-prepay-id' })
    return new Response(text, { headers: signed(text) })
  } })
  const result = await gateway.cloudFor('buyer-openid').cloudPay.unifiedOrder({
    body: '余额充值', outTradeNo: 'GHQ12345', totalFee: 1234, subMchId: config.mchId, tradeType: 'JSAPI'
  })
  assert.equal(result.returnCode, 'SUCCESS')
  assert.equal(result.resultCode, 'SUCCESS')
  assert.equal(result.payment.signType, 'RSA')
  assert.equal(result.payment.package, 'prepay_id=wx-real-prepay-id')
  const p = result.payment
  assert.equal(crypto.verify('RSA-SHA256', Buffer.from(`${config.appId}\n${p.timeStamp}\n${p.nonceStr}\n${p.package}\n`),
    merchant.publicKey, Buffer.from(p.paySign, 'base64')), true)
})

test('payment rejects unsigned upstream responses and invalid order/merchant configuration', async () => {
  const gateway = createWechat(config, { now, fetch: async () => response({ prepay_id: 'forged-prepay-id' }) })
  const order = { body: '余额充值', outTradeNo: 'GHQ12345', totalFee: 1234 }
  await assert.rejects(gateway.cloudFor('buyer').cloudPay.unifiedOrder(order), { statusCode: 502 })
  await assert.rejects(gateway.cloudFor('buyer').cloudPay.unifiedOrder({ ...order, totalFee: 12.34 }), { statusCode: 400 })
  await assert.rejects(gateway.cloudFor('buyer').cloudPay.unifiedOrder({ ...order, subMchId: 'wrong-merchant' }), { statusCode: 503 })
  await assert.rejects(gateway.cloudFor('').cloudPay.unifiedOrder(order), { statusCode: 401 })
  const broken = createWechat({ ...config, apiV3Key: 'short' }, { now, fetch: noFetch })
  await assert.rejects(broken.cloudFor('buyer').cloudPay.unifiedOrder(order), { statusCode: 503 })
})

test('verified AES-GCM payment notification normalizes the full order total', () => {
  const gateway = createWechat(config, { now, fetch: noFetch })
  const notification = paymentNotification()
  notification.rawBody = Buffer.from(notification.rawBody)
  assert.deepEqual(gateway.verifyAndDecryptPayment(notification), {
    outTradeNo: 'GHQ20261113001', totalFee: 1234, transactionId: '420000012345678', openid: 'buyer-openid'
  })
})

test('payment notification rejects tampering, stale/future signatures, and wrong serial', async (t) => {
  const gateway = createWechat(config, { now, fetch: noFetch })
  for (const [name, modify] of [
    ['modified raw body', (n) => { n.rawBody += ' ' }],
    ['stale signature', (n) => { n.headers = signed(n.rawBody, { timestamp: String(instant / 1000 - 301) }) }],
    ['future signature', (n) => { n.headers = signed(n.rawBody, { timestamp: String(instant / 1000 + 301) }) }],
    ['wrong platform serial', (n) => { n.headers['Wechatpay-Serial'] = 'WRONG' }],
    ['missing signature', (n) => { delete n.headers['Wechatpay-Signature'] }],
    ['signature probe', (n) => { n.headers['Wechatpay-Signature'] = 'WECHATPAY/SIGNTEST/invalid' }],
    ['parsed JSON instead of raw bytes', (n) => { n.rawBody = JSON.parse(n.rawBody) }]
  ]) {
    await t.test(name, () => {
      const notification = paymentNotification()
      modify(notification)
      assert.throws(() => gateway.verifyAndDecryptPayment(notification), { statusCode: 401 })
    })
  }
})

test('signed payment notification rejects wrong merchant/app, unsuccessful or malformed transactions', async (t) => {
  const gateway = createWechat(config, { now, fetch: noFetch })
  for (const patch of [
    { mchid: 'another-merchant' }, { appid: 'another-app' }, { trade_state: 'NOTPAY' }, { trade_type: 'NATIVE' },
    { payer: {} }, { transaction_id: '' }, { amount: { total: 0, currency: 'CNY' } },
    { amount: { total: 1.5, currency: 'CNY' } }, { amount: { total: 1234, currency: 'USD' } }
  ]) {
    await t.test(JSON.stringify(patch), () => {
      assert.throws(() => gateway.verifyAndDecryptPayment(paymentNotification(patch)), { statusCode: 400 })
    })
  }
  assert.throws(() => gateway.verifyAndDecryptPayment(paymentNotification({}, { event_type: 'REFUND.SUCCESS' })), { statusCode: 400 })
})

test('even correctly signed events must authenticate the encrypted resource', () => {
  const gateway = createWechat(config, { now, fetch: noFetch })
  const original = paymentNotification()
  const body = JSON.parse(original.rawBody)
  const ciphertext = Buffer.from(body.resource.ciphertext, 'base64')
  ciphertext[ciphertext.length - 1] ^= 1
  body.resource.ciphertext = ciphertext.toString('base64')
  const rawBody = JSON.stringify(body)
  assert.throws(() => gateway.verifyAndDecryptPayment({ rawBody, headers: signed(rawBody) }), { statusCode: 400 })
})
