import { apiFetch } from './apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DoctorRaceAssignment {
  raceId: number;
  raceNumber: number;
  scheduledTime: string;
  raceStatus: string;
  roundId: number;
  roundName: string;
  tournamentId: number;
  tournamentName: string;
  assignmentRole: string | null;
  assignedAt: string;
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * GET /api/doctors/race-assignments/my
 * Lấy danh sách race mà Doctor đang được phân công.
 * Backend có thể trả thẳng array hoặc ApiResponse<array>.
 */
export const getMyDoctorRaceAssignments = async (): Promise<DoctorRaceAssignment[]> => {
  const res = await apiFetch<any>('/doctors/race-assignments/my');

  // Xử lý cả hai dạng response:
  // 1. Thẳng array
  if (Array.isArray(res)) return res;
  // 2. ApiResponse { success, message, data: array }
  if (Array.isArray(res?.data)) return res.data;
  // 3. ApiResponse { data: { items: array } } (paged)
  if (Array.isArray(res?.data?.items)) return res.data.items;

  // Không có dữ liệu — trả về mảng rỗng thay vì crash
  return [];
};
