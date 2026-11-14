/** Command types are generated from the runtime JSON Schema. */
export type { ReviewJobInput, PaidCommandInput, ApplyJobInput } from './commands.generated'
export interface ReviewJobResult {
  id: string; status: number; version: number; topApplied: boolean; topFailed: boolean
}
export interface ApplicationResult { id: string; status: 'pending' | 'accepted' | 'rejected' | 'cancelled' }
export interface PromotionResult { id: string; cost: number; topExpireAt?: number; priorityAt?: number }
export interface PurchaseResult { id: string }
export interface ReviewableJob {
  id: string; title: string; salary: number; salaryUnit: number; workArea: string;
  contactName: string; status: number; version: number; rejectReason: string;
  ownerOpenid: string; createdAt: number; expireAt: number
}
export interface FinanceRecord {
  id: string; openid: string; type: number; amount: number;
  businessType: string; remark: string; createdAt: number
}
export interface BusinessTotal { name: string; amount: number; asset: 'points' | 'balance'; unit: '积分' | '元' }
export interface FinanceResult {
  records: FinanceRecord[]; total: number; page: number; pageSize: number; totalPage: number;
  rechargeTotal: number; paidOrderCount: number; pointsConsumed: number;
  balanceConsumed: number; byBusiness: BusinessTotal[]; asOf: number
}
export interface ApiFailure {
  success: false; code: number; errorCode: string; message: string; data: null; requestId: string
}
