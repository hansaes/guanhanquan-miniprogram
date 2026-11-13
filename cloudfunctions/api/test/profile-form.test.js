const assert = require('node:assert/strict')
const mock = require('./mock-cloud')
const { handle } = require('../router')
const call = (method, path, data = {}) =>
  handle({ method, path, data, openid: 'profile-form-test', token: '', cloud: mock.fakeSdk })

async function main() {
  mock.reset()
  await call('POST', '/auth/login')
  const form = {
    companyName: '测试工程公司',
    creditCode: '123456789012345678',
    license: 'cloud://test/license',
    address: '浙江省 杭州市 上城区 项目路1号',
    contactName: '测试联系人',
    contactPhone: '13800000000',
    region: '浙江省 杭州市 上城区',
    addressDetail: '项目路1号',
    scale: '50-99人',
    description: '设备安装',
    logo: 'cloud://test/logo'
  }
  assert.equal((await call('PUT', '/employers/profile', form)).success, true)
  const saved = (await call('GET', '/employers/profile')).data
  for (const [key, value] of Object.entries(form)) assert.equal(saved[key], value, key)
  assert.equal(saved.enterpriseStatus, 0)
  assert.equal(saved.verified, false)
  assert.equal(
    (await call('PUT', '/employers/profile', { ...form, contactPhone: '123' })).success,
    false
  )
  assert.equal((await call('GET', '/employers/profile')).data.contactPhone, form.contactPhone)
  console.log(
    'Enterprise form complete save/read-back, review status and invalid-phone rejection: passed'
  )
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
