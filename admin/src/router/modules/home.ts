const Layout = () => import("@/layout/index.vue");
export default {
  path: "/", name: "Home", component: Layout, redirect: "/overview",
  meta: { title: "工作台", icon: "ri/home-5-line", rank: 0 },
  children: [{
    path: "/overview", name: "Overview",
    component: () => import("@/views/guanhanquan/Overview.vue"),
    meta: { title: "运营概览", icon: "ri/dashboard-line" }
  }]
} satisfies RouteConfigsTable;
