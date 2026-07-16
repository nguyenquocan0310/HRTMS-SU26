import { useCallback, useEffect, useRef, useState } from 'react'
import type { CertificateMetadata } from '../../types/account.types'
import {
  downloadCertificateFile,
  getMyCertificateMetadata,
} from '../../services/certificateService'
import FilePreviewModal from './FilePreviewModal'

interface CertificateViewerProps {
  certificate: CertificateMetadata | null | undefined
}

const formatDate = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error && error.message
    ? error.message
    : 'Không thể tải chứng chỉ. Vui lòng thử lại.'

export default function CertificateViewer({ certificate: profileCertificate }: CertificateViewerProps) {
  const [fallbackCertificate, setFallbackCertificate] = useState<CertificateMetadata | null>(null)
  const [metadataLoading, setMetadataLoading] = useState(!profileCertificate)
  const [metadataError, setMetadataError] = useState('')
  const [activeAction, setActiveAction] = useState<'preview' | 'download' | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const objectUrlRef = useRef('')
  const certificate = profileCertificate ?? fallbackCertificate

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = ''
    }
    setPreviewUrl('')
  }, [])

  useEffect(() => {
    let cancelled = false

    if (profileCertificate) {
      return () => { cancelled = true }
    }

    void getMyCertificateMetadata()
      .then((result) => {
        if (!cancelled) setFallbackCertificate(result)
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setFallbackCertificate(null)
          setMetadataError(getErrorMessage(error))
        }
      })
      .finally(() => {
        if (!cancelled) setMetadataLoading(false)
      })

    return () => { cancelled = true }
  }, [profileCertificate])

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
  }, [])

  const createObjectUrl = async () => {
    if (!certificate) throw new Error('Bạn chưa có file chứng chỉ để xem.')
    revokeObjectUrl()
    const blob = await downloadCertificateFile(certificate.downloadUrl)
    const url = URL.createObjectURL(blob)
    objectUrlRef.current = url
    return url
  }

  const handlePreview = async () => {
    if (!certificate || activeAction) return
    setActiveAction('preview')
    setMetadataError('')
    try {
      setPreviewUrl(await createObjectUrl())
    } catch (error) {
      setMetadataError(getErrorMessage(error))
    } finally {
      setActiveAction(null)
    }
  }

  const handleDownload = async () => {
    if (!certificate || activeAction) return
    setActiveAction('download')
    setMetadataError('')
    try {
      const url = await createObjectUrl()
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = certificate.fileName
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => {
        if (objectUrlRef.current === url) revokeObjectUrl()
      }, 0)
    } catch (error) {
      setMetadataError(getErrorMessage(error))
    } finally {
      setActiveAction(null)
    }
  }

  const closePreview = () => revokeObjectUrl()

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="border-b border-gray-100 pb-4">
        <h2 className="text-lg font-bold text-gray-900">Chứng chỉ</h2>
        <p className="mt-1 text-sm text-gray-500">
          Xem hoặc tải lại file chứng chỉ đã nộp khi đăng ký.
        </p>
      </div>

      {!profileCertificate && metadataLoading ? (
        <div className="mt-5 h-24 animate-pulse rounded-lg bg-gray-100" aria-label="Đang tải chứng chỉ" />
      ) : certificate ? (
        <div className="mt-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><p className="text-sm font-semibold text-gray-700">Tên tệp</p><p className="mt-2 min-h-10 break-all rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-700">{certificate.fileName}</p></div>
            <div><p className="text-sm font-semibold text-gray-700">Loại tệp</p><p className="mt-2 min-h-10 rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-700">{certificate.contentType || 'Không xác định'}</p></div>
            <div><p className="text-sm font-semibold text-gray-700">Kích thước</p><p className="mt-2 min-h-10 rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-700">{formatFileSize(certificate.fileSizeBytes)}</p></div>
            <div><p className="text-sm font-semibold text-gray-700">Ngày tải lên</p><p className="mt-2 min-h-10 rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-700">{formatDate(certificate.uploadedAt)}</p></div>
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" onClick={() => void handlePreview()} disabled={activeAction !== null} className="rounded-md border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50">
              {activeAction === 'preview' ? 'Đang mở...' : 'Xem chứng chỉ'}
            </button>
            <button type="button" onClick={() => void handleDownload()} disabled={activeAction !== null} className="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
              {activeAction === 'download' ? 'Đang tải...' : 'Tải xuống'}
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-5 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          Chưa có file chứng chỉ.
        </p>
      )}

      {metadataError && (
        <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {metadataError}
        </p>
      )}

      {previewUrl && certificate && (
        <FilePreviewModal
          fileUrl={previewUrl}
          fileName={certificate.fileName}
          onClose={closePreview}
        />
      )}
    </section>
  )
}
