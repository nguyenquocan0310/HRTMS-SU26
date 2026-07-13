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
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{ 
            background: '#fff', borderRadius: 8, padding: 16, width: '90vw', height: '90vh', 
            position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' 
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 8, right: 8, border: 'none', background: '#eee',
            borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', fontWeight: 'bold', zIndex: 1
          }}
        >
          ×
        </button>
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {isPdf(fileUrl, fileName) ? (
            <iframe src={fileUrl} title={fileName ?? 'file'} style={{ width: '100%', height: '100%', border: 'none' }} />
          ) : (
            <img src={fileUrl} alt={fileName ?? 'file'} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          )}
        </div>
      </div>
    </div>
  );
};

export default FilePreviewModal;