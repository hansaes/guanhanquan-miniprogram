'use strict'

// Both legacy and migrated writes must use this lock until all participating
// workflows have equivalent concurrency guarantees.
module.exports = { LEGACY_WRITE_LOCK: '643276150102901' }
