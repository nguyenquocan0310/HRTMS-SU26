import { useEffect, useState } from 'react';
import { apiFetch } from '../../services/apiClient';
import FilePreviewModal from './FilePreviewModal';

const DETAIL_ENDPOINT: Record<string, string> = {
  Jockey: '/admin/jockeys',
  RaceReferee: '/admin/referees',
  Referee: '/admin/referees',
  Doctor: '/admin/doctors',
};

interface Props {
  userId: string;
  role: string;
  basicInfo: Record<string, string>;
  showActions: boolean;
  onApprove: () => void;
  onReject: () => void;
  onClose: () => void;
}

const UserDetailModal = ({ userId, role, basicInfo, showActions, onApprove, onReject, onClose }: Props) => {
  const [detail, setDetail] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailFailed, setDetailFailed] = useState(false);
  const [previewFile, setPreviewFile] = useState<string | null>(null);

  useEffect(() => {
    const endpoint = DETAIL_ENDPOINT[role];
    if (!endpoint) { setLoading(false); return; }
    apiFetch<{ success: boolean; data: Record<string, any> }>(`${endpoint}/${userId}`)
      .then((res) => setDetail(res.data ?? null))
      .catch(() => setDetailFailed(true))
      .finally(() => setLoading(false));
  }, [userId, role]);

  return (
    <>
      {/* Overlay mờ */}
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 998 }}
        onClick={onClose}
      />
      {/* Side panel trượt từ phải */}
      <div
        style={{
          position: 'fixed', top: 0, right: 0, height: '100vh', width: 420, maxWidth: '90vw',
          background: '#fff', zIndex: 999, boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
          display: 'flex', flexDirection: 'column', padding: 24, overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0 }}>Chi tiết đăng ký</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        <h5 style={{ color: '#999', fontSize: 12, letterSpacing: 1, marginBottom: 8 }}>THÔNG TIN NGƯỜI DÙNG</h5>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {Object.entries(basicInfo).map(([key, val]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: '#666', fontSize: 13 }}>{key}</span>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{val}</span>
            </div>
          ))}
        </div>

        <hr style={{ margin: '4px 0 20px', border: 'none', borderTop: '1px solid #eee' }} />

        <h5 style={{ color: '#999', fontSize: 12, letterSpacing: 1, marginBottom: 8 }}>HỒ SƠ ĐĂNG KÝ</h5>
        {loading && <p style={{ fontSize: 13, color: '#999' }}>Đang tải thông tin chi tiết...</p>}
        {!loading && detailFailed && (
          <p style={{ fontSize: 13, color: '#999' }}>
            Thông tin hồ sơ chi tiết (CCCD, chứng chỉ...) chưa sẵn sàng — cần backend hoàn thiện endpoint chi tiết.
          </p>
        )}
        {!loading && detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {Object.entries(detail).map(([key, val]) => {
              const isFile = typeof val === 'string' && (val.startsWith('http') || val.startsWith('blob:'));
              return (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ color: '#666', fontSize: 13 }}>{key}</span>
                  {isFile ? (
                    <button onClick={() => setPreviewFile(val)}>Xem file</button>
                  ) : (
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{String(val)}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Nút Approve/Reject — đẩy xuống cuối panel */}
        {showActions && (
          <div style={{ marginTop: 'auto', display: 'flex', gap: 12, paddingTop: 20, borderTop: '1px solid #eee' }}>
            <button
              onClick={onReject}
              style={{ flex: 1, padding: '10px 0', borderRadius: 6, border: '1px solid #e53935', color: '#e53935', background: '#fff', cursor: 'pointer', fontWeight: 600 }}
            >
              Reject
            </button>
            <button
              onClick={onApprove}
              style={{ flex: 1, padding: '10px 0', borderRadius: 6, border: 'none', color: '#fff', background: '#2e7d32', cursor: 'pointer', fontWeight: 600 }}
            >
              Approve
            </button>
          </div>
        )}

        {previewFile && (
          <FilePreviewModal fileUrl={previewFile} onClose={() => setPreviewFile(null)} />
        )}
      </div>
    </>
  );
};

export default UserDetailModal;