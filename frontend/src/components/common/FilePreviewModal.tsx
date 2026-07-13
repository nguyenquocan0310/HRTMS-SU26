interface Props {
  fileUrl: string;
  fileName?: string;
  onClose: () => void;
}

const isPdf = (url: string, name?: string) =>
  name?.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('.pdf');

const FilePreviewModal = ({ fileUrl, fileName, onClose }: Props) => {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.80)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '20px',
        boxSizing: 'border-box',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#111',
          borderRadius: 12,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          width: 'min(90vw, 1100px)',
          maxHeight: '88vh',
          boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            background: '#1e1e1e',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 13,
              color: '#ccc',
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {fileName ?? 'Xem tài liệu'}
          </span>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'rgba(255,255,255,0.12)',
              borderRadius: '50%',
              width: 30,
              height: 30,
              cursor: 'pointer',
              color: '#fff',
              fontSize: 18,
              lineHeight: '30px',
              textAlign: 'center',
              marginLeft: 12,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* ── Content ─────────────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#181818',
            minHeight: 0,
            padding: 16,
          }}
        >
          {isPdf(fileUrl, fileName) ? (
            <iframe
              src={fileUrl}
              title={fileName ?? 'file'}
              style={{
                width: '100%',
                height: 'calc(88vh - 54px)',
                border: 'none',
                display: 'block',
              }}
            />
          ) : (
            <img
              src={fileUrl}
              alt={fileName ?? 'file'}
              style={{
                display: 'block',
                maxWidth: '100%',
                maxHeight: 'calc(88vh - 86px)',
                objectFit: 'contain',
                borderRadius: 6,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default FilePreviewModal;