'use strict'
const { compile } = require('json-schema-to-typescript')
const { writeFile } = require('node:fs/promises')
const { resolve } = require('node:path')
const schemas = require('../../contracts/architecture-v1.json')

async function main() {
  const names = { reviewJob: 'ReviewJobInput', paidCommand: 'PaidCommandInput', applyJob: 'ApplyJobInput' }
  const types = await Promise.all(Object.entries(names).map(([key, name]) => compile(schemas[key], name, { bannerComment: '' })))
  await writeFile(resolve(__dirname, '../../contracts/commands.generated.d.ts'),
    '// Generated from architecture-v1.json by npm run contracts. Do not edit by hand.\n\n' + types.join('\n'))
  console.log('Generated shared command types from JSON Schema')
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
