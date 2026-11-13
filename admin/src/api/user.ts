import api from "./guanhanquan";
import type { DataInfo } from "@/utils/auth";

export type UserResult = { success: boolean; data: DataInfo<Date> };

export async function getLogin(credentials: object): Promise<UserResult> {
  const data = await api.login(credentials);
  return {
    success: true,
    data: {
      accessToken: data.token,
      refreshToken: "",
      expires: new Date(Date.now() + 12 * 60 * 60 * 1000),
      username: data.username,
      nickname: data.username,
      roles: [data.role],
      permissions: [],
      avatar: ""
    }
  };
}
