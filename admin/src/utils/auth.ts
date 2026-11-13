import { useUserStoreHook } from "@/store/modules/user";
import { storageLocal } from "@pureadmin/utils";
import { clearAdminSession, sessionTokenKey, sessionUserKey } from "./admin-session";

export interface DataInfo<T> {
  accessToken: string;
  expires: T;
  refreshToken: string;
  avatar?: string;
  username?: string;
  nickname?: string;
  roles?: string[];
  permissions?: string[];
}
export const userKey = sessionUserKey;
export function getToken(): DataInfo<number> | undefined {
  const info = storageLocal().getItem<DataInfo<number>>(userKey);
  const accessToken = localStorage.getItem(sessionTokenKey);
  if (!accessToken || !info || info.expires <= Date.now()) return undefined;
  return { ...info, accessToken };
}
export function setToken(data: DataInfo<Date>) {
  const { accessToken, ...info } = data;
  localStorage.setItem(sessionTokenKey, accessToken);
  storageLocal().setItem(userKey, { ...info, expires: new Date(data.expires).getTime() });
  const user = useUserStoreHook();
  user.SET_AVATAR(data.avatar ?? "");
  user.SET_USERNAME(data.username ?? "");
  user.SET_NICKNAME(data.nickname ?? "");
  user.SET_ROLES(data.roles ?? []);
  user.SET_PERMS(data.permissions ?? []);
}
export const removeToken = clearAdminSession;
