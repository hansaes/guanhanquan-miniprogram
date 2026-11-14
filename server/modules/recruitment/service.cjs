'use strict'
const { randomUUID } = require('node:crypto')
const { transaction } = require('../../application/transaction.cjs')
const { requireUser, requireAdmin } = require('../../application/actors.cjs')
const { requireCondition } = require('../../application/errors.cjs')
const { requireRecruitable, requireReviewable } = require('./domain.cjs')
const { getJob, notify } = require('./repository.cjs')
const { once } = require('../../application/idempotency.cjs')

/** @param {{pool: import('pg').Pool, encryptPhone: (value: string) => string, ledger: ReturnType<typeof import('../wallet/ledger.cjs').createLedger>}} dependencies */
function createRecruitmentService({ pool, encryptPhone, ledger }) {
  return {
    /** @param {import('../../application/types').Actor} actor @param {string} id @param {import('../../../contracts/architecture-v1').ReviewJobInput} input @returns {Promise<import('../../../contracts/architecture-v1').ReviewJobResult>} */
    async reviewJob(actor, id, input) {
      return transaction(pool, async client => {
        const admin = await requireAdmin(client, actor)
        const job = await getJob(client, id)
        requireReviewable(job, input.expectedVersion)
        requireCondition(!input.pass || !job.expire_at || job.expire_at.getTime() > Date.now(), 409, 'JOB_EXPIRED', '岗位已过期，请发布者更新后重新提交')
        const reason = input.pass ? '' : (input.reason || '').trim()
        requireCondition(input.pass || reason.length > 0, 400, 'REJECTION_REASON_REQUIRED', '请填写驳回原因')
        const status = input.pass ? 1 : 4
        const changed = await client.query(
          'UPDATE jobs SET status = $2, reject_reason = $3, updated_at = now() WHERE id = $1 AND status = 0 AND version = $4 RETURNING version',
          [id, status, reason, input.expectedVersion]
        )
        requireCondition(changed.rowCount === 1, 409, 'JOB_VERSION_CONFLICT', '岗位内容或状态已变化，请刷新后重新审核')
        let topApplied = false
        let topFailed = false
        let topDays = 0
        if (input.pass && job.request_top) {
          const terms = await ledger.promotionTerms(client, 'top')
          const cost = terms.cost
          topDays = terms.days
          topApplied = await ledger.debitPoints(client, {
            openid: job.owner_openid, units: cost,
            businessType: '置顶', businessId: id, remark: job.title
          })
          topFailed = !topApplied
          if (topApplied) await client.query(
            'UPDATE jobs SET is_top = true, top_expire_at = $2, request_top = false, updated_at = now() WHERE id = $1',
            [id, new Date(Date.now() + topDays * 86400000)]
          )
        }
        await client.query(
          'INSERT INTO job_reviews (id, job_id, admin_id, reviewed_version, decision, reason) VALUES ($1, $2, $3, $4, $5, $6)',
          [randomUUID(), id, admin.adminId, input.expectedVersion, input.pass ? 'approved' : 'rejected', reason]
        )
        const version = Number((await client.query('SELECT version FROM jobs WHERE id = $1', [id])).rows[0].version)
        await client.query(
          `INSERT INTO audit_logs (id, admin_id, username, method, path, target_id, attrs)
           VALUES ($1, $2, $3, 'POST', '/admin/jobs/:id/review', $4, $5::jsonb)`,
          [randomUUID(), admin.adminId, admin.username, id, JSON.stringify({ expectedVersion: input.expectedVersion, version, status, reason, requestId: actor.requestId })]
        )
        await notify(client, job.owner_openid, input.pass ? '招工信息审核通过' : '招工信息未通过审核',
          input.pass ? `「${job.title}」已上线${topApplied ? `，并已置顶 ${topDays} 天` : topFailed ? '；积分不足或账户不可用，未完成置顶' : ''}`
            : `「${job.title}」被驳回：${reason}`)
        return { id, status, version, topApplied, topFailed }
      })
    },

    /** @param {import('../../application/types').Actor} actor @param {string} id @param {import('../../../contracts/architecture-v1').ApplyJobInput} input @returns {Promise<import('../../../contracts/architecture-v1').ApplicationResult>} */
    async applyJob(actor, id, input) {
      return transaction(pool, async client => {
        const user = await requireUser(client, actor)
        const job = await getJob(client, id)
        requireRecruitable(job)
        requireCondition(job.owner_openid !== user.openid, 409, 'SELF_APPLICATION', '不能报名自己发布的岗位')
        requireCondition(user.phone, 400, 'PHONE_REQUIRED', '请先绑定手机号后再报名')
        const applicationId = randomUUID()
        const inserted = await client.query(
          `INSERT INTO applications (id, job_id, employer_openid, worker_openid, job_title, worker_name, worker_phone_enc, cover_letter, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending') ON CONFLICT DO NOTHING RETURNING id`,
          [applicationId, id, job.owner_openid, user.openid, job.title, user.nickname || '工友' + user.phone.slice(-4), encryptPhone(user.phone), input.coverLetter || '']
        )
        requireCondition(inserted.rowCount === 1, 409, 'APPLICATION_EXISTS', '你已报名该岗位')
        await client.query('UPDATE jobs SET apply_count = apply_count + 1 WHERE id = $1', [id])
        await notify(client, job.owner_openid, '收到新的报名', `${user.nickname || '有工人'} 报名了「${job.title}」`)
        return { id: applicationId, status: 'pending' }
      })
    },

    /** @param {import('../../application/types').Actor} actor @param {string} jobId @param {string} appId @param {'accepted'|'rejected'|'cancelled'} target @returns {Promise<import('../../../contracts/architecture-v1').ApplicationResult>} */
    async changeApplication(actor, jobId, appId, target) {
      return transaction(pool, async client => {
        const user = await requireUser(client, actor)
        const job = await getJob(client, jobId)
        const result = await client.query('SELECT id, job_id, worker_openid, status FROM applications WHERE id = $1 FOR UPDATE', [appId])
        const application = /** @type {import('../../application/types').ApplicationRow | undefined} */ (result.rows[0])
        requireCondition(application, 404, 'APPLICATION_NOT_FOUND', '报名记录不存在')
        if (!application) throw new Error('Missing application')
        requireCondition(application.job_id === jobId, 403, 'APPLICATION_FORBIDDEN', '报名记录与岗位不匹配')
        requireCondition(target === 'cancelled' ? application.worker_openid === user.openid : job.owner_openid === user.openid,
          403, 'APPLICATION_FORBIDDEN', '无权操作该报名')
        // A retry of the same completed transition returns its result without another notification.
        if (application.status === target) return { id: appId, status: target }
        requireCondition(application.status === 'pending', 409, 'APPLICATION_STATE_CONFLICT', '该报名已处理，请刷新后重试')
        if (target === 'accepted') requireRecruitable(job)
        const updated = await client.query("UPDATE applications SET status = $2, updated_at = now() WHERE id = $1 AND status = 'pending' RETURNING id", [appId, target])
        requireCondition(updated.rowCount === 1, 409, 'APPLICATION_STATE_CONFLICT', '该报名已处理，请刷新后重试')
        if (target === 'cancelled') {
          await client.query('UPDATE jobs SET apply_count = GREATEST(0, apply_count - 1) WHERE id = $1', [jobId])
        } else {
          await notify(client, application.worker_openid, target === 'accepted' ? '报名已通过' : '报名未通过',
            `「${job.title}」${target === 'accepted' ? '已同意你上岗，请联系老板' : '已被拒绝'}`)
        }
        return { id: appId, status: target }
      })
    },

    /** @param {import('../../application/types').Actor} actor @param {string} id @param {'top'|'refresh'} action @param {import('../../../contracts/architecture-v1').PaidCommandInput} input */
    async promoteJob(actor, id, action, input) {
      return transaction(pool, async client => {
        const user = await requireUser(client, actor)
        return once(client, { actor: user.openid, operation: `job.${action}`, key: input.idempotencyKey, resource: id }, async () => {
          const job = await getJob(client, id)
          requireCondition(job.owner_openid === user.openid, 403, 'JOB_FORBIDDEN', '无权操作该岗位')
          requireRecruitable(job)
          const { cost, days } = await ledger.promotionTerms(client, action)
          const charged = await ledger.debitPoints(client, {
            openid: user.openid, units: cost,
            businessType: action === 'top' ? '置顶' : '刷新', businessId: id, remark: job.title
          })
          requireCondition(charged, 402, 'INSUFFICIENT_POINTS', '积分不足')
          const now = Date.now()
          if (action === 'top') {
            const topExpireAt = now + days * 86400000
            await client.query('UPDATE jobs SET is_top = true, top_expire_at = $2, updated_at = now() WHERE id = $1', [id, new Date(topExpireAt)])
            return { id, cost, topExpireAt }
          }
          await client.query('UPDATE jobs SET priority_at = $2, updated_at = now() WHERE id = $1', [id, new Date(now)])
          return { id, cost, priorityAt: now }
        })
      })
    }
  }
}

module.exports = { createRecruitmentService }
