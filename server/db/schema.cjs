'use strict'

// Explicit mappings keep cloud API names stable while SQL uses typed snake_case columns.
const snake = (value) => value.replace(/[A-Z]/g, (letter) => '_' + letter.toLowerCase())
const fields = (groups) => Object.fromEntries(Object.entries(groups).flatMap(([type, names]) =>
  names.split(/\s+/).filter(Boolean).map((name) => [name, { column: snake(name), type }])))
const common = fields({ timestamp: 'createdAt updatedAt' })
const table = (name, groups) => ({ table: name, fields: { _id: { column: 'id', type: 'text' }, ...common, ...fields(groups) } })

const schema = {
  users: table('users', {
    text: 'nickname avatar phone userType city intro lastSignDate realName idCardEnc idCardMasked realNameRejectReason enterpriseRejectReason',
    integer: 'status age gender realNameStatus enterpriseStatus points', number: 'balance',
    boolean: 'realNameVerified enterpriseVerified showPhone profileTaskRewarded',
    timestamp: 'lastLoginAt deletedAt'
  }),
  admins: table('admins', { text: 'username salt passwordHash role', boolean: 'enabled' }),
  categories: table('categories', { text: 'key name description icon', integer: 'sort', boolean: 'enabled' }),
  configs: table('configs', { text: 'key', json: 'value' }),
  jobs: table('jobs', {
    text: 'title jobType workArea workAddress duration certificateReq ageLimit techReq otherReq otherBenefits contactName contactPhoneEnc employerName employerAvatar rejectReason',
    reference: 'ownerOpenid categoryId', number: 'salary latitude longitude',
    integer: 'salaryUnit payType accommodation travelReimburse workerCount genderLimit status viewCount applyCount version',
    boolean: 'wechatSame isUrgent isTop requestTop employerVerified', timestamp: 'priorityAt expireAt topExpireAt'
  }),
  resumes: table('resumes', {
    text: 'name avatar certificateInfo workExperience techDescription expectArea expectSalary availableTime contactPhoneEnc contactPhone wechat rejectReason',
    array: 'jobTypes certificateImages', integer: 'status reviewStatus', timestamp: 'deletedAt'
  }),
  applications: table('applications', {
    reference: 'jobId employerOpenid workerOpenid', text: 'jobTitle workerName workerPhoneEnc workerPhone coverLetter status'
  }),
  wallet: table('wallet', { reference: 'openid', integer: 'type', number: 'amount', text: 'businessType businessId remark' }),
  orders: table('orders', {
    reference: 'openid', text: 'outTradeNo status type transactionId', number: 'amount', integer: 'fen', timestamp: 'paidAt', json: 'raw'
  }),
  unlocks: table('unlocks', { reference: 'openid jobId' }),
  favorites: table('favorites', { reference: 'openid jobId' }),
  notifications: table('notifications', { reference: 'openid', text: 'title content', integer: 'type', boolean: 'isRead' }),
  reviews: table('reviews', { reference: 'fromOpenid toOpenid jobId', text: 'fromName content', number: 'rating' }),
  blacklist: table('blacklist', {
    text: 'bossPhoneHash bossPhoneMasked bossName reporterPhone reasonDetail revokeReason',
    reference: 'reporterOpenid reviewerId revokedBy', integer: 'reasonType status', array: 'evidence', timestamp: 'reviewedAt revokedAt'
  }),
  reports: table('reports', {
    reference: 'reporterOpenid jobId handlerId', text: 'bossPhone reason handleRemark', integer: 'reportType status', array: 'evidence', timestamp: 'handleTime'
  }),
  feedback: table('feedback', {
    reference: 'openid', text: 'content contact handleRemark', integer: 'type status', array: 'images', timestamp: 'handleTime'
  }),
  trainings: table('trainings', {
    text: 'title cover type teacher intro content', number: 'price', boolean: 'enabled', reference: 'createdBy updatedBy'
  }),
  training_enrolls: table('training_enrolls', { reference: 'openid trainingId' }),
  insurances: table('insurances', {
    text: 'name coverage intro', number: 'price', boolean: 'enabled', reference: 'createdBy updatedBy'
  }),
  user_insurances: table('user_insurances', { reference: 'openid insuranceId', text: 'name', number: 'price' }),
  banners: table('banners', { text: 'imageUrl link title', integer: 'sort', boolean: 'enabled' }),
  announcements: table('announcements', { text: 'title content', boolean: 'enabled pinned', timestamp: 'expireAt' }),
  auditLogs: table('audit_logs', { reference: 'adminId', text: 'username method path targetId' }),
  uploads: table('uploads', { reference: 'openid', text: 'filename mimeType dir', integer: 'size' })
}
schema.users.fields._openid = { column: 'openid', type: 'text' }
schema.resumes.fields._openid = { column: 'openid', type: 'reference' }

// A user's enterprise profile is an optional one-to-one value, represented by typed columns.
const enterpriseFields = ['companyName', 'creditCode', 'license', 'address', 'contactName']
for (const name of enterpriseFields) {
  schema.users.fields['enterprise.' + name] = { column: 'enterprise_' + snake(name), type: 'text' }
}

module.exports = { schema, enterpriseFields }
