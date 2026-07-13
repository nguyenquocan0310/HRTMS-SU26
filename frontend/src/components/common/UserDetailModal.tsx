import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../services/apiClient';
import FilePreviewModal from './FilePreviewModal';

// ─── Role classification ──────────────────────────────────────────────────────
// Roles that require Admin approval AND document upload during registration.
const APPROVAL_ROLES_WITH_DOCS = new Set(['Jockey', 'Referee', 'RaceReferee', 'Doctor']);

// ─── Types ───────────────────────────────────────────────────────────────────
interface AdminUserDetail {
  userId: number;
  username: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
  phoneNumber?: string | null;
  dateOfBirth?: string | null;
  createdAt: string;
}

interface CertificateMeta {
  certificateId: number;
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
  uploadedAt: string;
  downloadUrl: string;
}

interface Props {
  userId: string;
  role: string;
  basicInfo: Record<string, string>;
  showActions: boolean;
  onApprove: () => void;
  onReject: () => void;
  onClose: () => void;
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function formatDate(raw: string | null | undefined): string {
  if (!raw) return '—';
  try {
    return new Date(raw).toLocaleDateString('vi-VN');
  } catch {
    return raw;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ─── Sub-component: a single info row ─────────────────────────────────────────
const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
      padding: '8px 0',
      borderBottom: '1px solid #f0f0f0',
    }}
  >
    <span style={{ color: '#888', fontSize: 13, flexShrink: 0, minWidth: 120 }}>{label}</span>
    <span style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a', textAlign: 'right', wordBreak: 'break-word' }}>
      {value ?? '—'}
    </span>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────
const UserDetailModal = ({
  userId,
  role,
  basicInfo,
  showActions,
  onApprove,
  onReject,
  onClose,
}: Props) => {
  const [userDetail, setUserDetail] = useState<AdminUserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);

  const [certMeta, setCertMeta] = useState<CertificateMeta | null>(null);
  const [certLoading, setCertLoading] = useState(false);
  const [certError, setCertError] = useState<string | null>(null);

  const [previewFile, setPreviewFile] = useState<{ url: string; name: string } | null>(null);
  const [blobLoading, setBlobLoading] = useState(false);

  // Revoke blob URL when preview closes to avoid memory leak
  const closePreview = () => {
    if (previewFile?.url.startsWith('blob:')) URL.revokeObjectURL(previewFile.url);
    setPreviewFile(null);
  };

  const requiresDocApproval = APPROVAL_ROLES_WITH_DOCS.has(role);

  // ── Fetch enriched user detail from admin endpoint ────────────────────────
  useEffect(() => {
    setDetailLoading(true);
    const token = sessionStorage.getItem('token') ?? localStorage.getItem('token');
    fetch(`${API_BASE_URL}/admin/users/${userId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((res) => setUserDetail(res?.data ?? null))
      .catch(() => setUserDetail(null))
      .finally(() => setDetailLoading(false));
  }, [userId]);

  // ── Fetch certificate metadata for doc-approval roles ─────────────────────
  useEffect(() => {
    if (!requiresDocApproval) return;
    setCertLoading(true);
    setCertError(null);
    const token = sessionStorage.getItem('token') ?? localStorage.getItem('token');
    fetch(`${API_BASE_URL}/certificates/user/${userId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((res) => {
        if (res?.success && res.data) {
          setCertMeta(res.data);
        } else {
          setCertError('Người dùng chưa upload file chứng chỉ.');
        }
      })
      .catch(() => setCertError('Chưa có file chứng chỉ hoặc không thể tải thông tin.'))
      .finally(() => setCertLoading(false));
  }, [userId, requiresDocApproval]);

  // ── Fetch file with auth token → blob URL (avoids 401 on img src) ──────────
  const fetchAndPreviewCert = async () => {
    if (!certMeta) return;
    setBlobLoading(true);
    try {
      const token = sessionStorage.getItem('token') ?? localStorage.getItem('token');
      // downloadUrl from BE: may be '/api/certificates/{id}/download' or full URL
      const raw = certMeta.downloadUrl;
      const url = raw.startsWith('http') ? raw : `${API_BASE_URL}${raw.startsWith('/api') ? raw.slice(4) : raw}`;
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      setPreviewFile({ url: blobUrl, name: certMeta.fileName });
    } catch {
      setCertError('Không thể tải file. Vui lòng thử lại.');
    } finally {
      setBlobLoading(false);
    }
  };

  return (
    <>
      {/* ── Overlay ─────────────────────────────────────────────────────────── */}
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 998 }}
        onClick={onClose}
      />

      {/* ── Side panel ──────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          width: 440,
          maxWidth: '92vw',
          background: '#fff',
          zIndex: 999,
          boxShadow: '-6px 0 32px rgba(0,0,0,0.14)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Panel header ──────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '20px 24px 16px',
            borderBottom: '1px solid #eee',
            position: 'sticky',
            top: 0,
            background: '#fff',
            zIndex: 1,
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111' }}>
              Chi tiết người dùng
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#888' }}>
              {basicInfo.role} · {basicInfo.status}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: '#f5f5f5',
              borderRadius: '50%',
              width: 32,
              height: 32,
              cursor: 'pointer',
              fontSize: 18,
              color: '#555',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        {/* ── Body ──────────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto' }}>

          {/* Section: User Information */}
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1,
              color: '#aaa',
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            Thông tin người dùng
          </p>

          {detailLoading ? (
            <p style={{ fontSize: 13, color: '#999', padding: '12px 0' }}>Đang tải...</p>
          ) : (
            <div style={{ marginBottom: 24 }}>
              {/* Always-shown fields */}
              <InfoRow label="Username" value={userDetail?.username ?? basicInfo.username} />
              <InfoRow label="Họ và tên" value={userDetail?.fullName ?? basicInfo['Full Name'] ?? '—'} />
              <InfoRow
                label="Ngày sinh"
                value={formatDate(userDetail?.dateOfBirth)}
              />
              {/* CCCD is encrypted at rest; admin endpoint does not expose it — show placeholder */}
              <InfoRow label="CCCD/CMND" value="••••••••••••" />
              <InfoRow
                label="Số điện thoại"
                value={userDetail?.phoneNumber ?? '—'}
              />
              <InfoRow label="Email" value={userDetail?.email ?? basicInfo.email} />
            </div>
          )}

          {/* Section: Certification document (Jockey / Referee / Doctor only) */}
          {requiresDocApproval && (
            <>
              <div style={{ borderTop: '1px solid #eee', marginBottom: 16 }} />
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 1,
                  color: '#aaa',
                  textTransform: 'uppercase',
                  marginBottom: 12,
                }}
              >
                Tài liệu đăng ký
              </p>

              {certLoading && (
                <p style={{ fontSize: 13, color: '#999' }}>Đang tải thông tin tài liệu...</p>
              )}

              {!certLoading && certError && (
                <p style={{ fontSize: 13, color: '#bbb', fontStyle: 'italic' }}>{certError}</p>
              )}

              {!certLoading && certMeta && (
                <div
                  style={{
                    background: '#f8f9fb',
                    border: '1px solid #e8eaf0',
                    borderRadius: 10,
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  {/* File meta */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* File icon */}
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: '#e8eef8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4a6fa5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 13,
                          fontWeight: 600,
                          color: '#222',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {certMeta.fileName}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: '#999' }}>
                        {formatFileSize(certMeta.fileSizeBytes)} ·{' '}
                        {new Date(certMeta.uploadedAt).toLocaleDateString('vi-VN')}
                      </p>
                    </div>
                  </div>

                  {/* View File button */}
                  <button
                    type="button"
                    disabled={blobLoading}
                    onClick={fetchAndPreviewCert}
                    style={{
                      marginTop: 8,
                      padding: '8px 0',
                      border: 'none',
                      borderRadius: 7,
                      background: blobLoading
                        ? '#7a9cc8'
                        : 'linear-gradient(135deg, #4a6fa5, #2e4d80)',
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: blobLoading ? 'wait' : 'pointer',
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    {blobLoading ? (
                      'Đang tải...'
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        Xem tài liệu
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer: Approve / Reject actions ─────────────────────────────── */}
        {showActions && (
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid #eee',
              display: 'flex',
              gap: 12,
              background: '#fff',
            }}
          >
            <button
              type="button"
              onClick={onReject}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: 8,
                border: '1.5px solid #e53935',
                color: '#e53935',
                background: '#fff',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              Reject
            </button>
            <button
              type="button"
              onClick={onApprove}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: 8,
                border: 'none',
                color: '#fff',
                background: 'linear-gradient(135deg, #2e7d32, #1b5e20)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              Approve
            </button>
          </div>
        )}
      </div>

      {/* ── File preview overlay ─────────────────────────────────────────── */}
      {previewFile && (
        <FilePreviewModal
          fileUrl={previewFile.url}
          fileName={previewFile.name}
          onClose={closePreview}
        />
      )}
    </>
  );
};

export default UserDetailModal;