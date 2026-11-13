'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const L = require('../../cloudfunctions/api/lib')
const files = require('../files.cjs')

const config = { publicBaseUrl: 'https://api.example.test/api', userSecret: 'files-test-secret'.repeat(3) }
const owner = { openid: 'owner-openid', admin: null }
const other = { openid: 'other-openid', admin: null }
const admin = { openid: '', admin: { adminId: 'admin-1' } }
const id = '00000000-0000-4000-8000-000000000001'
const reference = 'ghq://' + id

function database(records = {}) {
  const data = { uploads: [{ _id: id, openid: owner.openid }], ...records }
  const queries = []
  return {
    queries,
    RegExp({ regexp, options }) { return new RegExp(regexp, options) },
    collection(name) {
      return {
        doc(documentId) {
          return { async get() {
            queries.push({ name, documentId })
            return { data: (data[name] || []).find(row => row._id === documentId) || null }
          } }
        },
        where(filter) {
          return { limit() { return { async get() {
            queries.push({ name, filter })
            return { data: (data[name] || []).filter(row => Object.entries(filter).every(([key, expected]) => {
              if (expected instanceof RegExp) return expected.test(Array.isArray(row[key]) ? row[key].join(',') : String(row[key] || ''))
              return row[key] === expected
            })).slice(0, 1) }
          } } } }
        }
      }
    }
  }
}

function signedPayload(value) {
  const url = new URL(value)
  assert.equal(url.origin, 'https://api.example.test')
  assert.equal(url.pathname, '/api/files/' + id)
  const payload = L.verifyToken(url.searchParams.get('token'), config.userSecret)
  assert.equal(payload.kind, 'file')
  assert.equal(payload.id, id)
  assert.ok(payload.exp > Date.now())
  return payload
}

test('input normalization checks ownership after trimming file references and URLs', async () => {
  const db = database()
  const url = files.signedUrl(id, config)
  for (const value of [reference, ` ${reference} `, `\t${reference}\n`, ` ${url} `]) {
    await assert.rejects(files.normalizeFiles({ content: value }, other, db, config), { statusCode: 403 })
    assert.deepEqual(await files.normalizeFiles({ nested: [{ image: value }] }, owner, db, config), {
      nested: [{ image: reference }]
    })
  }
  assert.deepEqual(await files.normalizeFiles({ content: ' normal text ' }, other, db, config), { content: ' normal text ' })
})

test('feedback text cannot mint access to another user private attachment', async () => {
  const db = database()
  const input = { content: ` ${reference} ` }
  await assert.rejects(files.normalizeFiles(input, other, db, config), { statusCode: 403 })
  // Also protect legacy stored rows and any later handler string coercion:
  // social.createFeedback trims content and myFeedback returns it verbatim.
  const oldResponse = { success: true, data: { records: [{ content: input.content.trim() }] } }
  const output = await files.hydrateFiles(oldResponse, config, other, db)
  assert.equal(output.data.records[0].content, '')
  assert.equal(oldResponse.data.records[0].content, reference)
})

test('private files are signed only for their owner or an authenticated administrator', async () => {
  const db = database()
  signedPayload((await files.hydrateFiles({ enterprise: { license: reference } }, config, owner, db)).enterprise.license)
  signedPayload((await files.hydrateFiles({ licenseUrl: reference }, config, admin, db)).licenseUrl)
  assert.equal(await files.hydrateFiles(reference, config, {}, db), '')
  assert.equal(await files.hydrateFiles(reference, config, other, db), '')
  assert.equal(await files.hydrateFiles(reference, config, owner), '')
  assert.equal(await files.hydrateFiles(reference, config, admin, database({ uploads: [] })), '')
})

test('an old signed URL cannot be renewed by a different user', async () => {
  const old = `${config.publicBaseUrl}/files/${id}?token=expired-capability`
  assert.equal(await files.hydrateFiles(old, config, other, database()), '')
  signedPayload(await files.hydrateFiles(old, config, owner, database()))
})

test('enabled training covers and banner images can be displayed publicly', async () => {
  for (const records of [
    { trainings: [{ enabled: true, cover: reference }] },
    { banners: [{ enabled: true, imageUrl: reference }] }
  ]) {
    signedPayload(await files.hydrateFiles(reference, config, {}, database(records)))
  }
})

test('disabled products or references in ordinary text do not publish files', async () => {
  for (const records of [
    { trainings: [{ enabled: false, cover: reference }] },
    { trainings: [{ enabled: true, content: reference, cover: 'other' }] },
    { banners: [{ enabled: false, imageUrl: reference }] },
    { banners: [{ enabled: true, title: reference, imageUrl: 'other' }] }
  ]) {
    assert.equal(await files.hydrateFiles(reference, config, other, database(records)), '')
  }
})

test('approved visible resume avatars are public and certificates require login', async () => {
  const avatarDb = database({ resumes: [{ status: 0, reviewStatus: 1, avatar: reference }] })
  signedPayload(await files.hydrateFiles(reference, config, {}, avatarDb))
  const certificateDb = database({ resumes: [{ status: 0, reviewStatus: 1, certificateImages: ['https://other.test/a', reference] }] })
  signedPayload(await files.hydrateFiles(reference, config, other, certificateDb))
  assert.equal(await files.hydrateFiles(reference, config, {}, certificateDb), '')
})

test('hidden or pending resume attachments and partial ID matches stay private', async () => {
  for (const resume of [
    { status: 1, reviewStatus: 1, avatar: reference, certificateImages: [reference] },
    { status: 0, reviewStatus: 0, avatar: reference, certificateImages: [reference] },
    { status: 0, reviewStatus: 1, certificateImages: [reference + 'trailing'] },
    { status: 0, reviewStatus: 1, certificateImages: ['prefix' + reference] },
    { status: 0, reviewStatus: 1, techDescription: reference }
  ]) {
    assert.equal(await files.hydrateFiles(reference, config, other, database({ resumes: [resume] })), '')
  }
})

test('duplicate response references share one ownership check per response', async () => {
  const db = database()
  const output = await files.hydrateFiles([reference, { license: reference }, reference], config, owner, db)
  for (const url of [output[0], output[1].license, output[2]]) signedPayload(url)
  assert.equal(db.queries.filter(query => query.name === 'uploads').length, 1)
})

test('download rejects expired, wrong-file and user tokens before opening any file', async () => {
  const requests = [
    '',
    L.signToken({ kind: 'file', id, exp: Date.now() - 1000 }, config.userSecret),
    L.signToken({ kind: 'file', id: 'another-file', exp: Date.now() + 10000 }, config.userSecret),
    L.signToken({ kind: 'user', openid: owner.openid, exp: Date.now() + 10000 }, config.userSecret)
  ]
  for (const token of requests) {
    const reply = { code(status) { this.status = status; return this }, send(body) { this.body = body; return this } }
    const db = { collection() { throw new Error('Unauthorized request reached file lookup') } }
    await files.download({ query: { token }, params: { id } }, reply, db, config)
    assert.equal(reply.status, 401)
  }
})
