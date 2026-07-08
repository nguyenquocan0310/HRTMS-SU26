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
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 8, padding: 16, maxWidth: '90vw', maxHeight: '90vh', position: 'relative' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 8, right: 8, border: 'none', background: '#eee',
            borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', fontWeight: 'bold',
          }}
        >
          ×
        </button>
        {isPdf(fileUrl, fileName) ? (
          <iframe src={fileUrl} title={fileName ?? 'file'} style={{ width: '80vw', height: '80vh', border: 'none' }} />
        ) : (
          <img src={fileUrl} alt={fileName ?? 'file'} style={{ maxWidth: '80vw', maxHeight: '80vh', objectFit: 'contain' }} />
        )}
      </div>
    </div>
  );
};

export default FilePreviewModal;