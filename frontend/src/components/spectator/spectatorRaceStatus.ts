const statusLabels: Record<string, string> = {
  upcoming: 'Sắp diễn ra',
  'pre-race': 'Chờ xuất phát',
  live: 'Đang phát trực tiếp',
  unofficial: 'Kết quả sơ bộ',
  official: 'Kết quả chính thức',
  completed: 'Đã hoàn tất',
  cancelled: 'Đã hủy',
}

const statusClasses: Record<string, string> = {
  live: 'bg-emerald-100 text-emerald-700',
  unofficial: 'bg-amber-100 text-amber-700',
  official: 'bg-blue-100 text-blue-700',
  completed: 'bg-slate-100 text-slate-700',
}

export const getSpectatorRaceStatusLabel = (status: string) => {
  const normalizedStatus = status.toLowerCase()
  return statusLabels[normalizedStatus] ?? status
}

export const getSpectatorRaceStatusClasses = (status: string) =>
  statusClasses[status.toLowerCase()] ?? 'bg-slate-100 text-slate-700'
