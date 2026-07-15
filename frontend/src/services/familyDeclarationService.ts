import { apiFetch } from './apiClient';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
}

export interface FamilyDeclaration {
  declarationId: number;
  declarantUserId: number;
  relatedPersonName: string;
  relatedUserId: number | null;
  relatedUserFullName: string | null;
  relatedUserRole: string | null;
  relationType: string;
  industryRole: string;
  notes: string | null;
  declaredAt: string;
}

export interface FamilyDeclarationPayload {
  relatedPersonName: string;
  relatedUserId: number | null;
  relationType: string;
  industryRole: string | null;
  relatedIdentityNumber?: string;
  notes: string;
}

export const getFamilyDeclarations = (): Promise<FamilyDeclaration[]> =>
  apiFetch<ApiResponse<FamilyDeclaration[]>>('/family-declarations').then((res) => {
    if (!res.success || !res.data) {
      throw new Error(res.message || 'Không tải được danh sách khai báo COI.');
    }
    return res.data;
  });

export const createFamilyDeclaration = (
  payload: FamilyDeclarationPayload
): Promise<FamilyDeclaration> =>
  apiFetch<ApiResponse<FamilyDeclaration>>('/family-declarations', {
    method: 'POST',
    body: JSON.stringify(payload),
  }).then((res) => {
    if (!res.success || !res.data) {
      throw new Error(res.message || 'Tạo khai báo COI thất bại.');
    }
    return res.data;
  });

export const updateFamilyDeclaration = (
  id: number,
  payload: FamilyDeclarationPayload
): Promise<FamilyDeclaration> =>
  apiFetch<ApiResponse<FamilyDeclaration>>(`/family-declarations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }).then((res) => {
    if (!res.success || !res.data) {
      throw new Error(res.message || 'Cập nhật khai báo COI thất bại.');
    }
    return res.data;
  });

export const deleteFamilyDeclaration = (id: number): Promise<void> =>
  apiFetch<ApiResponse<unknown>>(`/family-declarations/${id}`, {
    method: 'DELETE',
  }).then((res) => {
    if (!res.success) {
      throw new Error(res.message || 'Xóa khai báo COI thất bại.');
    }
  });
