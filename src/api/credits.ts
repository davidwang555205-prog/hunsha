/**
 * 积分 API（V2）
 *
 *   GET /api/credits/balance         当前用户积分余额
 *   GET /api/credits/transactions    当前用户积分明细（listCreditTransactions 在 api/admin.ts）
 */
import { apiRequest } from "./client";

export function getCreditBalance() {
  return apiRequest<{ balance: number }>("/api/credits/balance");
}
