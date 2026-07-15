import { useNavigate } from 'react-router-dom';

export default function JockeyDashboard() {
  const navigate = useNavigate();

  const statCards = [
    { title: 'Lời mời mới', value: '2', note: 'Đang chờ phản hồi', link: '/jockey/invitations' },
    { title: 'Cuộc đua sắp tới', value: '1', note: 'Đã được phân công', link: '/jockey/races' },
    { title: 'Tổng số trận', value: '47', note: 'Lịch sử thi đấu', link: '/jockey/history' },
    { title: 'Tỉ lệ thắng', value: '38%', note: 'Hiệu suất hiện tại', link: '/jockey/history' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tổng quan</h1>
        <p className="text-sm text-gray-500 mt-1">
          Theo dõi lời mời, lịch đua và thông tin thi đấu của bạn.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <button
            key={card.title}
            onClick={() => navigate(card.link)}
            className="text-left bg-white border border-gray-200 rounded-lg p-5 shadow-sm hover:border-blue-200 hover:bg-blue-50/30 transition-colors"
          >
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{card.title}</p>
            <p className="text-3xl font-bold text-gray-900 mt-3">{card.value}</p>
            <p className="text-xs text-gray-500 mt-2">{card.note}</p>
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
        <h2 className="text-base font-semibold text-gray-900">Thao tác nhanh</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <button
            onClick={() => navigate('/jockey/invitations')}
            className="px-4 py-2.5 text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-100 rounded-md hover:bg-blue-100 transition-colors"
          >
            Xem lời mời
          </button>
          <button
            onClick={() => navigate('/jockey/races')}
            className="px-4 py-2.5 text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-100 rounded-md hover:bg-blue-100 transition-colors"
          >
            Xem cuộc đua
          </button>
          <button
            onClick={() => navigate('/jockey/history')}
            className="px-4 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
          >
            Xem lịch sử
          </button>
        </div>
      </div>
    </div>
  );
}
