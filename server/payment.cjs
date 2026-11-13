const L = require('../cloudfunctions/api/lib')
const { randomBytes } = require('node:crypto')

async function createRecharge(db, wechat, config, openid, amount) {
  amount = Number(amount)
  if (!Number.isFinite(amount) || amount < 1 || amount > 5000 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001) return L.fail('充值金额需为 1 至 5000 元，最多两位小数')
  if (!config.wechat.mchId) return L.fail('微信支付尚未配置', 503)
  const outTradeNo = 'GHQ' + randomBytes(14).toString('hex')
  const fen = Math.round(amount * 100)
  const saved = await db.runInTransaction(async () => {
    const user = (await db.collection('users').where({ _openid: openid }).limit(1).get()).data[0]
    if (!user || user.status === 1) return L.fail('请先登录', 401)
    await db.collection('orders').add({ data: { outTradeNo, openid, amount, fen, status: 'pending', type: 'recharge', createdAt: Date.now() } })
    return L.ok()
  })
  if (!saved.success) return saved
  // The durable pending order exists before the network call; callbacks can
  // settle it even if the client times out. No database lock spans WeChat I/O.
  const response = await wechat.cloudFor(openid).cloudPay.unifiedOrder({
    body: '管焊圈-余额充值', outTradeNo, totalFee: fen, subMchId: config.wechat.mchId, tradeType: 'JSAPI'
  })
  if (response.returnCode !== 'SUCCESS' || response.resultCode !== 'SUCCESS') return L.fail('微信下单失败', 502)
  return L.ok({ outTradeNo, amount, payment: response.payment })
}

async function settlePayment(db, event) {
  return db.runInTransaction(async () => {
    const result = await db.collection('orders').where({ outTradeNo: event.outTradeNo }).limit(1).get()
    const order = result.data[0]
    if (!order || order.type !== 'recharge' || order.openid !== event.openid || Number(order.fen) !== Number(event.totalFee)) return L.fail('支付订单校验失败', 400)
    if (order.status === 'paid') {
      return order.transactionId === event.transactionId ? L.ok() : L.fail('支付流水不匹配', 409)
    }
    if (order.status !== 'pending') return L.fail('订单状态不可支付', 409)
    const user = (await db.collection('users').where({ _openid: order.openid }).limit(1).get()).data[0]
    if (!user) return L.fail('订单用户不存在', 400)
    const now = Date.now()
    await db.collection('orders').doc(order._id).update({ data: { status: 'paid', transactionId: event.transactionId, paidAt: now } })
    await db.collection('users').doc(user._id).update({ data: { balance: L.cmd().inc(order.fen / 100) } })
    await db.collection('wallet').add({ data: {
      openid: order.openid, type: 3, amount: order.fen / 100, businessType: '充值',
      businessId: order.outTradeNo, remark: '微信支付充值', createdAt: now
    } })
    return L.ok()
  })
}
module.exports = { settlePayment, createRecharge }
