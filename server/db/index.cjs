'use strict'

const { AsyncLocalStorage } = require('node:async_hooks')
const { randomUUID } = require('node:crypto')
const { schema, enterpriseFields } = require('./schema.cjs')
const { LEGACY_WRITE_LOCK } = require('./transaction-lock.cjs')

const OP = Symbol('databaseCommand')
function operation(kind, value) {
  return Object.freeze({ [OP]: kind, value,
    and(other) { return operation('and', [this, other]) },
    or(other) { return operation('or', [this, other]) }
  })
}
const commands = Object.fromEntries(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'inc']
  .map((kind) => [kind, (value) => operation(kind, value)]))
for (const kind of ['and', 'or']) commands[kind] = (...values) =>
  operation(kind, values.length === 1 && Array.isArray(values[0]) ? values[0] : values)
const command = Object.freeze(commands)
const quote = (value) => '"' + value.replace(/"/g, '""') + '"'
const owns = (obj, name) => Object.prototype.hasOwnProperty.call(obj, name)

function encode(value, type) {
  if (value === undefined) return null
  if (type === 'json') return JSON.stringify(value)
  if (value === null || (type === 'reference' && value === '')) return null
  if (type === 'timestamp') {
    const date = value instanceof Date ? value : new Date(typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value)
    if (!Number.isFinite(date.getTime())) throw new TypeError('Invalid timestamp')
    return date
  }
  if (type === 'number' || type === 'integer') {
    const number = Number(value)
    if (!Number.isFinite(number) || (type === 'integer' && !Number.isSafeInteger(number))) {
      throw new TypeError('Invalid ' + type + ' value')
    }
    return number
  }
  if (type === 'array') {
    if (!Array.isArray(value)) throw new TypeError('Expected an array')
    return value.map(String)
  }
  if (type === 'boolean') {
    if (typeof value !== 'boolean') throw new TypeError('Expected a boolean')
    return value
  }
  return String(value)
}

function decode(row, definition) {
  const result = { ...(row.attrs || {}) }
  for (const [field, spec] of Object.entries(definition.fields)) {
    const value = row[spec.column]
    if (value === null || value === undefined || field.startsWith('enterprise.')) continue
    result[field] = spec.type === 'timestamp' ? new Date(value).getTime()
      : ['integer', 'number'].includes(spec.type) ? Number(value) : value
  }
  if (definition === schema.users && row.enterprise_present) {
    result.enterprise = {}
    for (const field of enterpriseFields) {
      const value = row[definition.fields['enterprise.' + field].column]
      if (value !== null && value !== undefined) result.enterprise[field] = value
    }
  }
  return result
}

function writer(data, definition) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new TypeError('Expected a data object')
  const columns = new Map()
  const extras = {}
  for (const [field, value] of Object.entries(data)) {
    if (value === undefined || field === '_id') continue
    if (field === 'enterprise' && definition === schema.users) {
      if (value !== null && (typeof value !== 'object' || Array.isArray(value))) throw new TypeError('Invalid enterprise profile')
      columns.set('enterprise_present', value !== null)
      for (const key of enterpriseFields) columns.set(definition.fields['enterprise.' + key].column, value?.[key] == null ? null : String(value[key]))
    } else if (definition.fields[field]) {
      const spec = definition.fields[field]
      if (value && value[OP] === 'inc') {
        if (!['number', 'integer'].includes(spec.type)) throw new TypeError('Increment requires a numeric column')
        columns.set(spec.column, operation('inc', encode(value.value, spec.type)))
      } else {
        if (value && value[OP]) throw new TypeError('Only inc is supported in updates')
        columns.set(spec.column, encode(value, spec.type))
      }
    } else {
      if (['__proto__', 'prototype', 'constructor'].includes(field) || field.includes('.')) throw new TypeError('Invalid extension field')
      if (value && value[OP]) throw new TypeError('Commands require a typed column')
      extras[field] = value
    }
  }
  return { columns, extras }
}

class Builder {
  constructor(definition) { this.definition = definition; this.values = [] }
  param(value) { this.values.push(value); return '$' + this.values.length }
  field(name) {
    const spec = this.definition.fields[name]
    if (spec) return { ...spec, sql: quote(spec.column), text: spec.type === 'array' ? `array_to_string(${quote(spec.column)}, ',')` : `${quote(spec.column)}::text` }
    const key = this.param(name)
    return { type: 'json', sql: `(attrs -> ${key}::text)`, text: `(attrs ->> ${key}::text)` }
  }
  value(field, condition) {
    const kind = condition && condition[OP]
    if (kind === 'and' || kind === 'or') {
      if (!condition.value.length) return kind === 'and' ? 'TRUE' : 'FALSE'
      return '(' + condition.value.map((part) => this.value(field, part)).join(kind === 'and' ? ' AND ' : ' OR ') + ')'
    }
    if (kind === 'regexp' || condition instanceof RegExp) {
      const { regexp, options = '' } = kind ? condition.value : { regexp: condition.source, options: condition.flags }
      if (/[^imsu]/.test(options)) throw new TypeError('Unsupported regex flags')
      const pattern = (options.includes('s') ? '(?s)' : options.includes('m') ? '(?n)' : '') + regexp
      return `COALESCE(${field.text}, '') ${options.includes('i') ? '~*' : '~'} ${this.param(pattern)}`
    }
    if (kind === 'in' || kind === 'nin') {
      if (!Array.isArray(condition.value)) throw new TypeError('in/nin requires an array')
      const comparisons = condition.value.map((item) => this.value(field, operation(kind === 'in' ? 'eq' : 'neq', item)))
      return comparisons.length ? '(' + comparisons.join(kind === 'in' ? ' OR ' : ' AND ') + ')' : kind === 'in' ? 'FALSE' : 'TRUE'
    }
    const operator = { eq: '=', neq: 'IS DISTINCT FROM', gt: '>', gte: '>=', lt: '<', lte: '<=' }[kind || 'eq']
    if (!operator) throw new TypeError('Unsupported query command')
    const value = encode(kind ? condition.value : condition, field.type)
    if (operator === '=' && value === null) return `${field.sql} IS NULL`
    return `${field.sql} ${operator} ${this.param(value)}`
  }
  where(where = {}) {
    const kind = where && where[OP]
    if (kind === 'and' || kind === 'or') {
      if (!where.value.length) return kind === 'and' ? 'TRUE' : 'FALSE'
      return '(' + where.value.map((part) => this.where(part)).join(kind === 'and' ? ' AND ' : ' OR ') + ')'
    }
    if (!where || typeof where !== 'object' || Array.isArray(where) || kind) throw new TypeError('Invalid query condition')
    return Object.entries(where).map(([field, value]) => this.value(this.field(field), value)).join(' AND ') || 'TRUE'
  }
}

function createDatabase(pool) {
  if (!pool || typeof pool.query !== 'function' || typeof pool.connect !== 'function') throw new TypeError('A pg Pool is required')
  const context = new AsyncLocalStorage()
  let sequence = 0
  async function lock(state) {
    if (!state.root.locked) {
      await state.client.query('SELECT pg_advisory_xact_lock($1::bigint)', [LEGACY_WRITE_LOCK])
      state.root.locked = true
    }
  }
  function active(bound) {
    const state = bound || context.getStore()
    if (state && (state.closed || state.root.closed)) throw new Error('Transaction is already closed')
    return state
  }
  async function execute(text, values, write, bound) {
    const state = active(bound)
    if (state) {
      if (write) await lock(state)
      return state.client.query(text, values)
    }
    if (write) return runInTransaction(() => execute(text, values, true), { write: true })
    return pool.query(text, values)
  }
  async function begin(parent, write) {
    if (parent) {
      if (write) await lock(parent)
      const savepoint = 'ghq_' + ++sequence
      await parent.client.query('SAVEPOINT ' + savepoint)
      return { client: parent.client, root: parent.root, savepoint, closed: false, lockBefore: parent.root.locked }
    }
    const client = await pool.connect()
    const state = { client, closed: false, locked: false }
    state.root = state
    try {
      await client.query('BEGIN')
      if (write) await lock(state)
      return state
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      client.release()
      throw error
    }
  }
  async function finish(state, commit) {
    if (state.closed) return
    try {
      if (state.savepoint) {
        if (!commit) {
          await state.client.query('ROLLBACK TO SAVEPOINT ' + state.savepoint)
          // PostgreSQL releases locks first acquired after a rolled-back savepoint.
          state.root.locked = state.lockBefore
        }
        await state.client.query('RELEASE SAVEPOINT ' + state.savepoint)
      } else {
        const result = await state.client.query(commit ? 'COMMIT' : 'ROLLBACK')
        if (commit && result.command !== 'COMMIT') throw new Error('Transaction aborted before commit')
      }
    } catch (error) {
      if (!state.savepoint) await state.client.query('ROLLBACK').catch(() => {})
      throw error
    } finally {
      state.closed = true
      if (!state.savepoint) state.client.release()
    }
  }
  async function runInTransaction(callback, { write = true } = {}, bound) {
    const state = await begin(active(bound), write)
    try {
      const result = await context.run(state, () => callback(api(state)))
      await finish(state, result?.success !== false)
      return result
    } catch (error) {
      await finish(state, false).catch(() => {})
      throw error
    }
  }

  class Query {
    constructor(name, bound, state = {}) {
      if (!owns(schema, name)) throw new TypeError('Unknown collection: ' + name)
      this.name = name; this.definition = schema[name]; this.bound = bound
      this.filter = state.filter || {}; this.order = state.order || []; this.offset = state.offset || 0; this.maximum = state.maximum
    }
    copy(patch) { return new Query(this.name, this.bound, { filter: this.filter, order: this.order, offset: this.offset, maximum: this.maximum, ...patch }) }
    where(filter) { return this.copy({ filter: filter || {} }) }
    orderBy(field, direction = 'asc') {
      if (!['asc', 'desc'].includes(direction.toLowerCase())) throw new TypeError('Invalid sort direction')
      return this.copy({ order: [...this.order, [field, direction.toUpperCase()]] })
    }
    skip(number) { if (!Number.isSafeInteger(number) || number < 0) throw new TypeError('Invalid offset'); return this.copy({ offset: number }) }
    limit(number) { if (!Number.isSafeInteger(number) || number < 0) throw new TypeError('Invalid limit'); return this.copy({ maximum: number }) }
    async get() {
      const builder = new Builder(this.definition)
      let sql = `SELECT * FROM ${quote(this.definition.table)} WHERE ${builder.where(this.filter)}`
      const order = this.order.map(([field, direction]) => `${builder.field(field).sql} ${direction} NULLS LAST`)
      if (!this.order.some(([field]) => field === '_id')) order.push('id ASC')
      sql += ' ORDER BY ' + order.join(', ')
      if (this.maximum !== undefined) sql += ' LIMIT ' + builder.param(this.maximum)
      if (this.offset) sql += ' OFFSET ' + builder.param(this.offset)
      const result = await execute(sql, builder.values, false, this.bound)
      return { data: result.rows.map((row) => decode(row, this.definition)) }
    }
    async count() {
      const builder = new Builder(this.definition)
      const result = await execute(`SELECT count(*) AS total FROM ${quote(this.definition.table)} WHERE ${builder.where(this.filter)}`, builder.values, false, this.bound)
      return { total: Number(result.rows[0].total) }
    }
    async update({ data }) {
      const { columns, extras } = writer(data, this.definition)
      const builder = new Builder(this.definition)
      const assignments = [...columns].map(([column, value]) => `${quote(column)} = ${value && value[OP] === 'inc'
        ? `COALESCE(${quote(column)}, 0) + ${builder.param(value.value)}` : builder.param(value)}`)
      if (Object.keys(extras).length) assignments.push('attrs = attrs || ' + builder.param(JSON.stringify(extras)) + '::jsonb')
      if (!assignments.length) return { stats: { updated: 0 } }
      const sql = `UPDATE ${quote(this.definition.table)} SET ${assignments.join(', ')} WHERE ${builder.where(this.filter)}`
      const result = await execute(sql, builder.values, true, this.bound)
      return { stats: { updated: result.rowCount } }
    }
    async remove() {
      const builder = new Builder(this.definition)
      const result = await execute(`DELETE FROM ${quote(this.definition.table)} WHERE ${builder.where(this.filter)}`, builder.values, true, this.bound)
      return { stats: { removed: result.rowCount } }
    }
    async insert(data, id, replace) {
      const { columns, extras } = writer(data, this.definition)
      for (const value of columns.values()) if (value && value[OP]) throw new TypeError('Increment is only valid in updates')
      columns.set('id', id); columns.set('attrs', JSON.stringify(extras))
      const builder = new Builder(this.definition)
      let sql = `INSERT INTO ${quote(this.definition.table)} (${[...columns.keys()].map(quote).join(', ')}) VALUES (${[...columns.values()].map((value) => builder.param(value)).join(', ')})`
      if (replace) {
        const reset = [...new Set(Object.values(this.definition.fields).map((spec) => spec.column))].filter((column) => column !== 'id')
        if (this.definition === schema.users) reset.push('enterprise_present')
        reset.push('attrs')
        sql += ' ON CONFLICT (id) DO UPDATE SET ' + reset.map((column) => `${quote(column)} = EXCLUDED.${quote(column)}`).join(', ')
      }
      await execute(sql, builder.values, true, this.bound)
      return { _id: id, stats: { updated: 1 } }
    }
    async add({ data }) { return this.insert(data, data?._id || randomUUID(), false) }
    doc(id) {
      if (typeof id !== 'string' || !id) throw new TypeError('Document id is required')
      const query = this.copy({ filter: { _id: id }, maximum: 1 })
      return {
        async get() {
          const result = await query.get()
          if (!result.data.length) { const error = new Error('Document not found: ' + id); error.code = 'DOCUMENT_NOT_FOUND'; throw error }
          return { data: result.data[0] }
        },
        update: (payload) => query.update(payload),
        remove: () => query.remove(),
        set: ({ data }) => query.insert(data, id, true)
      }
    }
  }
  function api(bound) {
    return {
      command,
      RegExp: ({ regexp, options = '' }) => operation('regexp', { regexp: String(regexp), options }),
      collection: (name) => new Query(name, bound),
      runInTransaction: (callback, options) => runInTransaction(callback, options, bound),
      async startTransaction() {
        const state = await begin(active(bound), true)
        return { ...api(state), commit: () => finish(state, true), rollback: () => finish(state, false) }
      }
    }
  }
  return api()
}

module.exports = { createDatabase }
