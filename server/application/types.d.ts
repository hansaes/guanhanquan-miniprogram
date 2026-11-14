export interface Actor {
  openid?: string;
  admin?: { adminId: string; username: string } | null;
  requestId?: string;
}
export interface UserRow {
  id: string; openid: string; nickname: string; phone: string; status: string | number;
}
export interface JobRow {
  id: string; title: string; owner_openid: string; status: string | number; version: string | number;
  expire_at: Date | null; request_top: boolean;
}
export interface ApplicationRow {
  id: string; job_id: string; worker_openid: string; status: string;
}
