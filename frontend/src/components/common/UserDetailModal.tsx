import { useEffect, useState } from 'react';
import { apiFetch } from '../../services/apiClient';
import FilePreviewModal from './FilePreviewModal';

// map role -> endpoint GET detail (khớp pattern APPROVE_ENDPOINT)
const DETAIL_ENDPOINT: Record<string, string> = {
  Jockey: '/admin/jockeys',
  RaceReferee: '/admin/referees',
  Referee: '/admin/referees',
  Doctor: '/admin/doctors',
};

interface Props {
  userId: string;
  role: string;
  onClose: () => void;
}

const UserDetailModal = ({ userId, role, onClose }: Props) => {
  const [detail, setDetail] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewFile, setPreviewFile] = useState<string | null>(null);

  useEffect(() => {
    const endpoint = DETAIL_ENDPOINT[role];
    if (!endpoint) { setLoading(false); return; }
    // TODO: đổi path nếu BE dùng route khác, ví dụ `${endpoint}/${userId}/detail`
    apiFetch<{ success: boolean; data: Record<string, any> }>(`${endpoint}/${userId}`)
      .then((res) => setDetail(res.data ?? null))
      .catch((err) => console.error('Failed to fetch detail:', err))
      .finally(() => setLoading(false));
  }, [userId, role]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 8, padding: 24, minWidth: 400, maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3>Thông tin đăng ký</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        {loading && <p>Đang tải...</p>}
        {!loading && !detail && <p>Không thể tải thông tin chi tiết.</p>}

        {!loading && detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(detail).map(([key, val]) => {
              const isFile = typeof val === 'string' && (val.startsWith('http') || val.startsWith('blob:'));
              return (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ color: '#666', fontSize: 13 }}>{key}</span>
                  {isFile ? (
                    <button onClick={() => setPreviewFile(val)}>Xem file</button>
                  ) : (
                    <span style={{ fontSize: 13 }}>{String(val)}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {previewFile && (
          <FilePreviewModal fileUrl={previewFile} onClose={() => setPreviewFile(null)} />
        )}
      </div>
    </div>
  );
};

export default UserDetailModal;