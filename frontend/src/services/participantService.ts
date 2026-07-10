import { apiFetch } from './apiClient';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
}

export interface ParticipantResponse {
  participantId: number;
  tournamentId: number;
  tournamentName: string | null;
  userId: number;
  fullName: string;
  email: string;
  role: string;
  status: string;
  screeningStatus: string;
  screeningReason: string | null;
  rejectionReason: string | null;
  registeredAt: string;
  approvedAt: string | null;
}

export const getRoster = (
  tournamentId: number,
  role?: string,
  status?: string
): Promise<ParticipantResponse[]> => {
  const params = new URLSearchParams();
  if (role) params.set('role', role);
  if (status) params.set('status', status);
  const query = params.toString() ? `?${params}` : '';
  // Không catch nuốt lỗi — để lỗi thật hiện ra thay vì bảng rỗng câm.
  return apiFetch<ApiResponse<ParticipantResponse[]>>(
    `/tournament/${tournamentId}/participants${query}`
  ).then((res) => {
    if (!res.success) throw new Error(res.message || 'Không tải được roster.');
    return res.data ?? [];
  });
};

export const approveParticipant = (participantId: number): Promise<ParticipantResponse> =>
  apiFetch<ApiResponse<ParticipantResponse>>(
    `/admin/tournament-participants/${participantId}/approve`,
    { method: 'PATCH' }
  ).then((res) => {
    if (!res.success || !res.data) throw new Error(res.message || 'Approve thất bại.');
    return res.data;
  });

export const rejectParticipant = (participantId: number, reason: string): Promise<ParticipantResponse> =>
  apiFetch<ApiResponse<ParticipantResponse>>(
    `/admin/tournament-participants/${participantId}/reject`,
    { method: 'PATCH', body: JSON.stringify({ reason }) }
  ).then((res) => {
    if (!res.success || !res.data) throw new Error(res.message || 'Reject thất bại.');
    return res.data;
  });