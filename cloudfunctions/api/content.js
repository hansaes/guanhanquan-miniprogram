// 运营内容的唯一默认源。value 是持久化业务值，后台只修改 label，不改历史数据语义。
const options = (labels) => labels.map((label, i) => ({ value: i + 1, label }))
const words = (labels) => labels.map((label) => ({ value: label, label }))
const defaults = {
  brandName: '管焊圈',
  searchPlaceholder: '搜索工种、地区、薪资',
  safetyNotice: '凡要求缴纳押金、保证金的招工信息，请谨慎核实并举报。',
  badges: { urgent: '急招', top: '置顶', verified: '企业认证' },
  tabs: ['首页', '发布招工', '我的'],
  shortcuts: [
    { value: 'urgent', label: '急招专区', icon: 'fire-filled', tone: 'blue', enabled: true },
    { value: 'verified', label: '名企直招', icon: 'auth-filled', tone: 'green', enabled: true },
    { value: 'latest', label: '今日最新', icon: 'calendar-filled', tone: 'orange', enabled: true },
    { value: 'salary', label: '高薪推荐', icon: 'medal-filled', tone: 'purple', enabled: true }
  ],
  dictionaries: {
    salaryUnits: options(['元/天', '元/小时', '元/月', '面议']),
    payTypes: options(['压一付一', '月结', '完工结算', '公司直发', '面议']),
    accommodation: options(['管吃住', '管住不管吃', '不管吃住', '面议']),
    travel: options(['报销往返', '报销单程', '不报销', '面议']),
    certificates: words(['双证', '单证', '无证', '有证成手', '不限']),
    companyScales: words(['50人以下', '50-200人', '200-500人', '500-1000人', '1000人以上']),
    reportTypes: options(['虚假信息', '重复信息', '违法信息', '骚扰/诈骗', '其他']),
    blacklistReasons: options([
      '欠薪/拖薪',
      '放鸽子（到现场没活）',
      '虚假信息（待遇不符）',
      '态度恶劣/克扣工资',
      '其他违规'
    ]),
    experience: words(['1 年以内', '1-3 年', '3-5 年', '5-8 年', '8 年以上']),
    availability: words(['随时到岗', '一周内', '半个月后', '面议']),
    salaryRanges: [
      { value: 'all', label: '薪资不限', min: 0, max: 0 },
      { value: '200', label: '200–300元/天', min: 200, max: 300 },
      { value: '300', label: '300–500元/天', min: 300, max: 500 },
      { value: '500', label: '500元/天以上', min: 500, max: 0 }
    ],
    timeRanges: [
      { value: 0, label: '时间不限' },
      { value: 24, label: '今天' },
      { value: 72, label: '近三天' },
      { value: 168, label: '近一周' }
    ]
  },
  services: [
    {
      value: 'realname',
      label: '实名认证',
      icon: 'auth',
      tone: 'green',
      path: '/pages/mine/certification',
      enabled: true
    },
    {
      value: 'enterprise',
      label: '企业认证',
      icon: 'staff',
      tone: 'blue',
      path: '/pages/employer/certification',
      enabled: true
    },
    {
      value: 'messages',
      label: '消息通知',
      icon: 'notification-filled',
      tone: 'orange',
      path: '/pages/message/index',
      enabled: true
    },
    {
      value: 'support',
      label: '客服中心',
      icon: 'headphones',
      tone: 'purple',
      path: '/pages/service/index',
      enabled: true
    },
    {
      value: 'applications',
      label: '我的报名',
      icon: 'paperplane',
      tone: 'blue',
      path: '/pages/mine/myApplications',
      enabled: true
    },
    {
      value: 'insurance',
      label: '保险服务',
      icon: 'wallet',
      tone: 'green',
      path: '/pages/mine/insurance',
      enabled: true
    },
    {
      value: 'training',
      label: '在线培训',
      icon: 'videocam',
      tone: 'blue',
      path: '/pages/training/training',
      enabled: true
    },
    {
      value: 'blacklist',
      label: '信用查询',
      icon: 'search',
      tone: 'orange',
      path: '/pages/blacklist/query',
      enabled: true
    }
  ],
  faqs: [
    { q: '发布招工收费吗？', a: '发布免费，审核通过后展示。置顶和刷新费用以操作时提示为准。' },
    { q: '如何联系招工方？', a: '打开招工详情，点击查看电话。需要积分时会先显示确认提示。' },
    { q: '如何获得积分？', a: '前往积分与余额页面签到，具体奖励以页面显示为准。' },
    { q: '如何修改简历？', a: '进入“我的” → “我的简历”，点击编辑，保存后提交审核。' }
  ]
}
module.exports = { defaults }
