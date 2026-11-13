const Layout = () => import("@/layout/index.vue");
export default [
  {
    path: "/review", name: "Review", component: Layout, redirect: "/jobs",
    meta: { title: "审核中心", icon: "ri/shield-check-line", rank: 1 },
    children: [
      { path: "/jobs", name: "Jobs", component: () => import("@/views/guanhanquan/Jobs.vue"), meta: { title: "招工审核" } },
      { path: "/resumes", name: "Resumes", component: () => import("@/views/guanhanquan/Resumes.vue"), meta: { title: "简历审核" } },
      { path: "/verifications", name: "Verifications", component: () => import("@/views/guanhanquan/Verifications.vue"), meta: { title: "认证审核" } },
      { path: "/reports", name: "Reports", component: () => import("@/views/guanhanquan/Reports.vue"), meta: { title: "举报处理" } },
      { path: "/appeals", name: "Appeals", component: () => import("@/views/guanhanquan/Appeals.vue"), meta: { title: "黑名单申诉" } }
    ]
  },
  {
    path: "/operations", name: "Operations", component: Layout, redirect: "/content",
    meta: { title: "内容运营", icon: "ri/apps-2-line", rank: 2 },
    children: [
      { path: "/content", name: "Content", component: () => import("@/views/guanhanquan/Content.vue"), meta: { title: "小程序内容" } },
      { path: "/categories", name: "Categories", component: () => import("@/views/guanhanquan/Categories.vue"), meta: { title: "工种管理" } },
      { path: "/banners", name: "Banners", component: () => import("@/views/guanhanquan/Banners.vue"), meta: { title: "轮播图" } },
      { path: "/announcements", name: "Announcements", component: () => import("@/views/guanhanquan/Announcements.vue"), meta: { title: "公告管理" } }
    ]
  },
  {
    path: "/people", name: "People", component: Layout, redirect: "/users",
    meta: { title: "用户与服务", icon: "ri/group-line", rank: 3 },
    children: [
      { path: "/users", name: "Users", component: () => import("@/views/guanhanquan/Users.vue"), meta: { title: "用户管理" } },
      { path: "/blacklist", name: "Blacklist", component: () => import("@/views/guanhanquan/Blacklist.vue"), meta: { title: "黑老板库" } },
      { path: "/feedback", name: "Feedback", component: () => import("@/views/guanhanquan/Feedback.vue"), meta: { title: "客服反馈" } }
    ]
  },
  {
    path: "/products", name: "Products", component: Layout, redirect: "/trainings",
    meta: { title: "产品管理", icon: "ri/store-2-line", rank: 4 },
    children: [
      { path: "/trainings", name: "Trainings", component: () => import("@/views/guanhanquan/Products.vue"), meta: { title: "培训课程", productKind: "trainings" } },
      { path: "/insurances", name: "Insurances", component: () => import("@/views/guanhanquan/Products.vue"), meta: { title: "保险产品", productKind: "insurances" } }
    ]
  },
  {
    path: "/system", name: "System", component: Layout, redirect: "/settings",
    meta: { title: "财务与设置", icon: "ri/settings-3-line", rank: 5 },
    children: [
      { path: "/settings", name: "Settings", component: () => import("@/views/guanhanquan/Settings.vue"), meta: { title: "费用与奖励" } },
      { path: "/finance", name: "Finance", component: () => import("@/views/guanhanquan/Finance.vue"), meta: { title: "财务流水" } },
      { path: "/audit-logs", name: "AuditLogs", component: () => import("@/views/guanhanquan/AuditLogs.vue"), meta: { title: "操作日志" } }
    ]
  }
] satisfies RouteConfigsTable[];
