const assert = require('node:assert/strict')
const mock = require('./mock-cloud')
const { handle } = require('../router')
const L = require('../lib')
const call = (path, data = {}, openid = 'reader') =>
  handle({ method: 'GET', path, data, openid, token: '', cloud: mock.fakeSdk })

async function main() {
  mock.reset()
  const { data: tree } = await call('/regions/tree', {}, '')
  assert.equal(tree.length, 34)
  const cities = tree.flatMap((province) => province.children)
  assert.equal(cities.length, 369)
  assert.equal(cities.flatMap((city) => city.children || []).length, 3478)
  const beijing = tree.find((province) => province.value === '110000')
  assert.equal(beijing.children[0].text, '北京市')
  assert.ok(beijing.children[0].children.some((district) => district.text === '朝阳区'))
  const areas = ['江苏省 南京市 鼓楼区', '福建省 福州市 鼓楼区', '沈阳苏家屯', '辽宁大连']
  for (const workArea of areas)
    await L.db()
      .collection('jobs')
      .add({
        data: {
          title: '测试岗位',
          workArea,
          status: 1,
          expireAt: Date.now() + 86400000
        }
      })
  const records = async (regionCode) => (await call('/jobs/list', { regionCode })).data.records
  assert.deepEqual(
    (await records('320106')).map((job) => job.workArea),
    [areas[0]]
  )
  assert.deepEqual(
    (await records('350102')).map((job) => job.workArea),
    [areas[1]]
  )
  assert.equal((await records('210000')).length, 2)
  assert.deepEqual(
    (await records('210111')).map((job) => job.workArea),
    [areas[2]]
  )
  assert.equal((await call('/jobs/list', { regionCode: 'unknown' })).code, 400)
  assert.equal((await call('/jobs/list')).data.records.length, 4)
  console.log(
    'Region tree, province/city/district filtering, legacy addresses and same-name districts: passed'
  )
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
