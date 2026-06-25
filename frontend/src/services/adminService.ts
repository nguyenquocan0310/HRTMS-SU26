// ─── Service Admin: dashboard, duyệt hồ sơ, audit log ───────────────────────
// Gọi API thật (BE: /api/admin/...). Dùng cho AdminDashboard.

import { apiFetch } from './apiClient';

interface PendingApprovalsData {
  totalPending: number;
}

/** Số hồ sơ (Referee + Doctor + Jockey) đang chờ duyệt. */
export const getPendingApprovalsCount = async (): Promise<number> => {
  const res = await apiFetch<{ success: boolean; data: PendingApprovalsData }>(
    '/admin/pending-approvals'
  );
  return res.data?.totalPending ?? 0;
};

export interface AuditLogItem {
  auditLogId: number;
  actorId: number;
  action: string;
  entityName: string;
  entityId: string;
  oldValue: string | null;
  newValue: string | null;
  ipAddress: string | null;
  createdAt: string;
}

/** Lấy N bản ghi audit log mới nhất cho mục Recent Activity. */
export const getRecentAuditLogs = async (limit = 5): Promise<AuditLogItem[]> => {
  const res = await apiFetch<{ success: boolean; data: AuditLogItem[] }>(
    `/admin/audit-logs?page=1&pageSize=${limit}`
  );
  return res.data ?? [];
};
