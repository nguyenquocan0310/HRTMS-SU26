import type {
  Horse,
  OwnerEarnings,
  RaceEntry,
  RacePurseSummary,
} from '../types/owner.types';
import { apiFetch } from './apiClient';

// ─── Horse CRUD (dùng apiFetch — không hard-code localhost) ──────────────────

export const getMyHorses = async (): Promise<Horse[]> => {
  try {
    const res = await apiFetch<any>('/horses/my');
    // Backend trả ApiResponse<T> hoặc thẳng array
    return res?.data || (Array.isArray(res) ? res : []);
  } catch (error) {
    console.error('Error fetching my horses:', error);
    throw error;
  }
};

export const getHorseById = async (id: number): Promise<Horse> => {
  try {
    const res = await apiFetch<any>(`/horses/${id}`);
    return res?.data || res;
  } catch (error) {
    console.error(`Error fetching horse with ID ${id}:`, error);
    throw error;
  }
};

/**
 * Create a new horse
 */
export const createHorse = async (
  data: Omit<Horse, 'horseID' | 'ownerID' | 'createdAt'>
): Promise<Horse> => {
  try {
    const res = await apiFetch<any>('/horses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res?.data || res;
  } catch (error) {
    console.error('Error creating horse:', error);
    throw error;
  }
};

/**
 * Update an existing horse
 */
export const updateHorse = async (
  id: number,
  data: Partial<Horse>
): Promise<Horse> => {
  try {
    const response = await apiFetch<ApiResponse<Horse> | Horse>(`/horses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return unwrapApiResponse(response, 'Cập nhật thông tin ngựa thất bại.');
  } catch (error) {
    console.error(`Error updating horse with ID ${id}:`, error);
    throw error;
  }
};

/**
 * GET /api/horses/{horseId}/enrollments
 * Trả về danh sách enrollment của ngựa theo từng giải.
 * Trả về null nếu lỗi mạng — caller sẽ hiển thị fallback thay vì crash.
 * Trả về [] nếu thành công nhưng không có enrollment nào.
 */
export const getHorseEnrollments = async (
  horseId: number | string
): Promise<HorseEnrollmentResponse[] | null> => {
  try {
    const res = await apiFetch<any>(`/horses/${horseId}/enrollments`);
    // Backend có thể trả ApiResponse<list> hoặc thẳng array
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.data?.items)) return res.data.items;
    // Single enrollment wrapped in data
    if (res?.data && typeof res.data === 'object' && !Array.isArray(res.data)) return [res.data];
    return [];
  } catch (error) {
    console.error(`Error fetching enrollments for horse ${horseId}:`, error);
    return null; // null = network error; [] = no enrollments
  }
};

/**
 * Get all race entries for the current user's horses
 */
export const getMyRaceEntries = async (
  status?: string,
  entryFeeStatus?: string,
  page: number = 1,
  pageSize: number = 20
): Promise<RaceEntry[]> => {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (entryFeeStatus) params.set('entryFeeStatus', entryFeeStatus);
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));

  interface ApiResponse<T> { success: boolean; message: string; data: T | null }
  const res = await apiFetch<ApiResponse<RaceEntry[]>>(`/race-entries/my?${params.toString()}`);
  if (!res.success || !res.data) throw new Error(res.message || 'Không tải được danh sách đăng ký.');
  return res.data;
};


/**
 * Get available jockeys for a tournament
 */
export const getAvailableJockeys = async (tournamentId: number = 1, page: number = 1, pageSize: number = 20): Promise<any[]> => {
  try {
    const params = new URLSearchParams();
    params.set('tournamentId', String(tournamentId));
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));

    const data = await apiFetch<any>(`/jockeys/available?${params.toString()}`);

    // Extract array of jockeys from standard API response envelopes
    if (Array.isArray(data)) return data;
    if (data && data.data) {
      if (Array.isArray(data.data)) return data.data;
      if (data.data.items && Array.isArray(data.data.items)) return data.data.items;
    }
    if (data && data.items && Array.isArray(data.items)) return data.items;
    return [];
  } catch (error) {
    console.error('Error fetching available jockeys:', error);
    throw error;
  }
};

/**
 * Get owner pairings (invitations) with status/horse filter
 */
export const getOwnerPairings = async (
  status?: string,
  horseId?: string,
  page: number = 1,
  pageSize: number = 20
): Promise<any[]> => {
  try {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (horseId) params.append('horseId', horseId);
    params.append('page', String(page));
    params.append('pageSize', String(pageSize));

    const data = await apiFetch<any>(`/owner/pairings?${params.toString()}`);

    // Extract array of pairings from standard API response envelopes
    if (Array.isArray(data)) return data;
    if (data && data.data) {
      if (Array.isArray(data.data)) return data.data;
      if (data.data.items && Array.isArray(data.data.items)) return data.data.items;
    }
    if (data && data.items && Array.isArray(data.items)) return data.items;
    return [];
  } catch (error) {
    console.error('Error fetching owner pairings:', error);
    throw error;
  }
};

export interface InviteJockeyPayload {
  tournamentId?: number;
  horseId: number;
  jockeyId: number;
  requestMessage: string;
}

/**
 * POST /api/pairings
 * API trả trực tiếp PairingResponseDto (không có ApiResponse wrapper).
 * apiFetch sẽ throw nếu HTTP status không phải 2xx — không cần check .success.
 */
export const inviteJockey = async (payload: InviteJockeyPayload): Promise<any> => {
  return apiFetch<any>('/pairings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};



/**
 * PATCH /api/pairings/{id}/confirm
 * Owner xác nhận ghép cặp sau khi Jockey đã accept.
 * Pairing chuyển từ Accepted → Confirmed.
 */
export const confirmPairing = async (pairingId: string | number): Promise<any> => {
  interface ApiResponse<T> { success: boolean; message: string; data: T | null }
  const res = await apiFetch<ApiResponse<any>>(`/pairings/${pairingId}/confirm`, {
    method: 'PATCH',
  });
  // Backend trả success:false với message chi tiết khi nghiệp vụ không hợp lệ
  if (res && res.success === false) {
    throw new Error(res.message || 'Xác nhận ghép cặp thất bại.');
  }
  return res?.data ?? res;
};

/**
 * PATCH /api/pairings/{id}/cancel
 * Owner chỉ có thể hủy lời mời đang Pending hoặc Accepted.
 */
export const cancelPairing = async (pairingId: string | number): Promise<any> => {
  try {
    const res = await apiFetch<any>(`/pairings/${pairingId}/cancel`, {
      method: 'PATCH',
    });

    if (res?.success === false) {
      throw new Error(res.message || 'Hủy lời mời ghép cặp thất bại.');
    }

    return res?.data ?? res;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const normalized = message.toLowerCase();

    if (normalized.includes('pairing was not found') || normalized.includes('pairing_not_found')) {
      throw new Error('Không tìm thấy lời mời ghép cặp.');
    }
    if (normalized.includes('does not belong') || normalized.includes('horse_not_owned')) {
      throw new Error('Bạn không có quyền hủy lời mời này.');
    }
    if (normalized.includes('only pending or accepted') || normalized.includes('invalid_status')) {
      throw new Error('Chỉ có thể hủy lời mời đang chờ hoặc đã được Jockey chấp nhận nhưng chưa xác nhận ghép cặp.');
    }

    throw error instanceof Error ? error : new Error('Hủy lời mời ghép cặp thất bại.');
  }
};

// ─── Horse + Tournament Registration (dùng apiFetch — không hard-code localhost) ───

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
}

export interface HorseCreatePayload {
  name: string;
  birthYear: number;
  gender: string;
  color: string;
  pedigree?: string;
  weight: number;
  identifyingMarks: string;
  breed: string;
  vaccinationRecordRef?: string;
  dopingTestDate?: string;
  dopingTestResult?: string;
  legalConsentAccepted: boolean;
}

export interface HorseCreateResponse {
  horseId: number;
  name: string;
  breed: string;
  birthYear: number;
  gender: string;
  color: string;
  weight: number;
  identifyingMarks: string;
  screeningStatus?: 'AutoEligible' | 'ManualReview' | 'AutoRejected' | string;
  screeningReason?: string | null;
  adminApprovalStatus?: string | null;
  enrollmentId?: number;
  tournamentId?: number;
  tournamentName?: string | null;
  enrollmentStatus?: string;
}

export interface HorseEnrollmentResponse {
  enrollmentId: number;
  horseId: number;
  horseName: string;
  tournamentId: number;
  tournamentName: string | null;
  status: string;
  screeningStatus: 'AutoEligible' | 'ManualReview' | 'AutoRejected' | string;
  screeningReason: string | null;
  adminApprovalStatus: string;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

const assertPositiveId = (value: number | string, fieldName: string): void => {
  const normalized = typeof value === 'string' ? value.trim() : value;
  if (normalized === '' || !Number.isInteger(Number(normalized)) || Number(normalized) <= 0) {
    throw new Error(`${fieldName} không hợp lệ.`);
  }
};

/**
 * Lấy các enrollment của Owner trong một giải. Caller có thể yêu cầu riêng
 * trạng thái duyệt để không nhầm hồ sơ trong kho với ngựa đủ điều kiện dự giải.
 */
export const getMyTournamentHorseEnrollments = async (
  tournamentId: number,
  adminApprovalStatus?: string
): Promise<HorseEnrollmentResponse[]> => {
  const params = new URLSearchParams({ tournamentId: String(tournamentId) });
  if (adminApprovalStatus) params.set('adminApprovalStatus', adminApprovalStatus);

  const res = await apiFetch<ApiResponse<HorseEnrollmentResponse[]> | HorseEnrollmentResponse[]>(
    `/horses/my/enrollments?${params.toString()}`
  );

  return unwrapApiResponse(res, 'Không tải được danh sách ngựa của giải.');
};

const unwrapApiResponse = <T>(
  response: ApiResponse<T> | T,
  fallbackMessage: string
): T => {
  if (response && typeof response === 'object' && 'success' in response) {
    const wrapped = response as ApiResponse<T>;
    if (!wrapped.success || wrapped.data === null || wrapped.data === undefined) {
      throw new Error(wrapped.message || fallbackMessage);
    }
    return wrapped.data;
  }
  if (response === null || response === undefined) throw new Error(fallbackMessage);
  return response as T;
};

export const getOwnerEarnings = async (): Promise<OwnerEarnings> => {
  const response = await apiFetch<ApiResponse<OwnerEarnings> | OwnerEarnings>(
    '/owner/earnings'
  );

  return unwrapApiResponse(response, 'Không tải được thông tin thu nhập.');
};

export const getRacePurseSummary = async (
  raceId: number | string
): Promise<RacePurseSummary> => {
  assertPositiveId(raceId, 'raceId');

  const response = await apiFetch<ApiResponse<RacePurseSummary> | RacePurseSummary>(
    `/races/${raceId}/purse-summary`
  );

  return unwrapApiResponse(
    response,
    'Không tải được chi tiết tiền thưởng của cuộc đua.'
  );
};

/**
 * POST /api/horses/{horseId}/enrollments
 * Đưa một hồ sơ ngựa đã có trong kho vào một giải cụ thể để backend screening theo giải.
 */
export const enrollHorseToTournament = async (
  horseId: number | string,
  tournamentId: number
): Promise<HorseEnrollmentResponse> => {
  const res = await apiFetch<ApiResponse<HorseEnrollmentResponse>>(
    `/horses/${horseId}/enrollments`,
    {
      method: 'POST',
      body: JSON.stringify({ tournamentId }),
    }
  );

  if (!res.success || !res.data) {
    throw new Error(res.message || 'Đăng ký ngựa vào giải thất bại.');
  }

  return res.data;
};

/**
 * DELETE /api/horses/{horseId}/enrollments/{enrollmentId}
 * Rút ngựa khỏi một giải. Backend sẽ chặn nếu enrollment đã rút hoặc ngựa
 * đang có pairing active trong giải.
 */
export const withdrawHorseFromTournament = async (
  horseId: number | string,
  enrollmentId: number | string
): Promise<string> => {
  assertPositiveId(horseId, 'horseId');
  assertPositiveId(enrollmentId, 'enrollmentId');

  const res = await apiFetch<ApiResponse<string>>(
    `/horses/${horseId}/enrollments/${enrollmentId}`,
    { method: 'DELETE' }
  );

  if (!res.success) {
    throw new Error(res.message || 'Rút ngựa khỏi giải thất bại.');
  }

  return res.message || res.data || 'Đã rút ngựa khỏi giải.';
};

/**
 * POST /api/horses
 * Chỉ tạo hồ sơ ngựa trong kho/stable, không gắn giải.
 */
export const createHorseProfile = async (
  payload: HorseCreatePayload
): Promise<HorseCreateResponse> => {
  const horseRes = await apiFetch<ApiResponse<HorseCreateResponse>>('/horses', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!horseRes.success || !horseRes.data) {
    throw new Error(horseRes.message || 'Tạo hồ sơ ngựa thất bại.');
  }

  return horseRes.data;
};
/**
 * PATCH /api/race-entries/{id}/confirm
 */
export const confirmRaceEntry = async (id: number): Promise<any> => {
  interface ApiResponse<T> { success: boolean; message: string; data: T | null }
  const res = await apiFetch<ApiResponse<any>>(`/race-entries/${id}/confirm`, {
    method: 'PATCH',
  });
  if (!res.success) throw new Error(res.message || 'Xác nhận tham gia thất bại.');
  return res.data;
};

/**
 * DELETE /api/race-entries/{id}?reason={reason}
 */
export const withdrawRaceEntry = async (id: number, reason: string): Promise<any> => {
  interface ApiResponse<T> { success: boolean; message: string; data: T | null }
  const params = new URLSearchParams();
  params.set('reason', reason);
  const res = await apiFetch<ApiResponse<any>>(`/race-entries/${id}?${params.toString()}`, {
    method: 'DELETE',
  });
  if (!res.success) throw new Error(res.message || 'Rút lui thất bại.');
  return res.data;
};


