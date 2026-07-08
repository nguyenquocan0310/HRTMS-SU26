import { useState } from 'react';
import FilePreviewModal from './FilePreviewModal';
import { uploadCertificateFile } from '../../services/jockeyService';

interface Props {
  value: string; // URL hiện tại (rỗng nếu chưa có)
  fileName?: string;
  onChange: (url: string, fileName: string) => void;
}

const CertificateUpload = ({ value, fileName, onChange }: Props) => {
  const [showPreview, setShowPreview] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadCertificateFile(file);
      onChange(result.url, result.fileName);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*,.pdf"
        onChange={handleFileSelect}
        disabled={uploading}
      />
      {uploading && <p style={{ fontSize: 12, color: '#999' }}>Đang tải lên...</p>}
      {value && !uploading && (
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13 }}>{fileName || 'Đã chọn file'}</span>
          <button type="button" onClick={() => setShowPreview(true)}>
            Xem
          </button>
        </div>
      )}
      {showPreview && (
        <FilePreviewModal fileUrl={value} fileName={fileName} onClose={() => setShowPreview(false)} />
      )}
    </div>
  );
};

export default CertificateUpload;