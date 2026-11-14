'use strict'
const { requireCondition } = require('../../application/errors.cjs')

/** @param {import('../../application/types').JobRow} job @param {number} [now] */
function requireRecruitable(job, now = Date.now()) {
  requireCondition(Number(job.status) === 1 && (!job.expire_at || job.expire_at.getTime() > now),
    409, 'JOB_NOT_RECRUITABLE', '该岗位已下架或过期')
}

/** @param {import('../../application/types').JobRow} job @param {number} version */
function requireReviewable(job, version) {
  requireCondition(Number(job.status) === 0, 409, 'JOB_NOT_PENDING', '岗位状态已变化，请刷新后重试')
  requireCondition(Number(job.version) === version, 409, 'JOB_VERSION_CONFLICT', '岗位内容已更新，请刷新后重新审核')
}

module.exports = { requireRecruitable, requireReviewable }
