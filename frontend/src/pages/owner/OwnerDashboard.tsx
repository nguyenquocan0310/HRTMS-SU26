import { useNavigate } from 'react-router-dom'

const quickActions = [
  {
    to: '/owner/horses',
    title: 'Ngựa của tôi',
    description: 'Xem danh sách và trạng thái ngựa',
  },
  {
    to: '/owner/horses/register',
    title: 'Đăng ký ngựa mới',
    description: 'Thêm ngựa mới vào một giải đấu',
  },
  {
    to: '/owner/tournaments',
    title: 'Giải đấu',
    description: 'Xem và đăng ký tham gia giải',
  },
  {
    to: '/owner/jockey-invite',
    title: 'Mời Jockey',
    description: 'Ghép kỵ sĩ với ngựa của bạn',
  },
  {
    to: '/owner/schedule-confirm',
    title: 'Xác nhận lịch',
    description: 'Xác nhận tham gia cuộc đua',
  },
  {
    to: '/owner/protest',
    title: 'Khiếu nại',
    description: 'Nộp và theo dõi khiếu nại',
  },
]

const OwnerDashboard = () => {
  const navigate = useNavigate()

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Tổng quan</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Chào mừng trở lại. Chọn một mục bên dưới để bắt đầu.
        </p>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200 mb-6" />

      {/* Quick actions section */}
      <div className="mb-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
          Truy cập nhanh
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {quickActions.map((action) => (
            <button
              key={action.to}
              onClick={() => navigate(action.to)}
              className="group text-left bg-white border border-gray-200 rounded-lg px-4 py-4 hover:border-blue-300 hover:bg-blue-50 transition-colors"
            >
              <p className="text-sm font-semibold text-gray-800 group-hover:text-blue-700 transition-colors">
                {action.title}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{action.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Info note */}
      <div className="mt-8 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
        <p className="text-xs text-blue-700">
          <span className="font-semibold">Lưu ý:</span> Để đăng ký ngựa, bạn phải được duyệt tham
          gia ít nhất một giải đấu trước. Vào <strong>Giải đấu</strong> để đăng ký.
        </p>
      </div>
    </div>
  )
}

export default OwnerDashboard