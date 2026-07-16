import { API_BASE_URL, apiFetch } from './apiClient';

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T | null;
}

export type ReportType = 'tournament-results' | 'race-results' | 'purse-payouts' | 'entry-list';

export interface ReportPreview {
  type: ReportType;
  tournamentId: number;
  tournamentName: string;
  headers: string[];
  rows: Array<Array<string | null>>;
}

const unwrap = <T>(response: ApiResponse<T>): T => {
  if (!response.success || response.data == null) {
    throw new Error(response.message || 'Không tải được báo cáo.');
  }
  return response.data;
};

export const getReportPreview = async (type: ReportType, tournamentId: number): Promise<ReportPreview> =>
  unwrap(
    await apiFetch<ApiResponse<ReportPreview>>(`/reports/${type}?tournamentId=${tournamentId}`)
  );

export const exportCsvReport = async (type: ReportType, tournamentId: number): Promise<{ blob: Blob; fileName: string }> => {
  const token = sessionStorage.getItem('token') ?? localStorage.getItem('token');
  const response = await fetch(
    `${API_BASE_URL}/reports/${type}/export?tournamentId=${tournamentId}&format=csv`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} }
  );

  if (!response.ok) {
    let message = 'Không thể xuất báo cáo. Vui lòng thử lại.';
    try {
      const body = await response.json() as { message?: string; title?: string; errors?: Record<string, string[]> };
      const validationMessage = Object.values(body.errors ?? {}).flat().join(' ');
      message = body.message ?? body.title ?? (validationMessage || message);
    } catch {
      // The user-facing fallback above is intentional for non-JSON responses.
    }
    throw new Error(message);
  }

  const disposition = response.headers.get('content-disposition') ?? '';
  const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plainName = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  const fileName = encodedName ? decodeURIComponent(encodedName) : plainName ?? `bao-cao-${type}.csv`;
  return { blob: await response.blob(), fileName };
};
