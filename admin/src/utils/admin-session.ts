export const sessionTokenKey = "ghq_admin_token";
export const sessionUserKey = "ghq-admin-user";

export function clearAdminSession() {
  localStorage.removeItem(sessionTokenKey);
  localStorage.removeItem(sessionUserKey);
}

export function expireAdminSession() {
  clearAdminSession();
  const current = window.location.hash.slice(1);
  if (!current.startsWith("/login")) {
    window.location.replace(`${window.location.pathname}${window.location.search}#/login?redirect=${encodeURIComponent(current || "/overview")}`);
  }
}
