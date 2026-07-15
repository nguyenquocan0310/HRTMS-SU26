import { useNavigate } from 'react-router-dom'

const quickActions = [
  {
    to: '/owner/horses/register',
    title: 'Tạo hồ sơ ngựa',
    description: 'Khai báo thông tin cơ bản, y tế và phả hệ cho ngựa mới.',
    primary: true,
  },
  {
    to: '/owner/tournaments',
    title: 'Đăng ký giải đấu',
    description: 'Xem các giải đang mở và gửi yêu cầu tham gia roster.',
  },
  {
    to: '/owner/jockey-invite',
    title: 'Mời Jockey',
    description: 'Tìm kỵ sĩ phù hợp và gửi lời mời ghép cặp.',
  },
]

const overviewCards = [
  {
    title: 'Hồ sơ ngựa',
    value: 'Quản lý',
    description: 'Tạo, theo dõi duyệt hồ sơ và đăng ký ngựa vào giải.',
  },
  {
    title: 'Đăng ký cuộc đua',
    value: 'Theo dõi',
    description: 'Xác nhận lịch đua, trạng thái entry và phí tham gia.',
  },
  {
    title: 'Ghép Jockey',
    value: 'Kết nối',
    description: 'Mời jockey và hoàn tất ghép cặp trước khi vào race.',
  },
]

const OwnerDashboard = () => {
  const navigate = useNavigate()

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-1 xl:grid-cols-[1.6fr_0.8fr] gap-6">
        <div className="rounded-3xl border border-blue-100 bg-blue-50/60 px-8 py-8 overflow-hidden relative">
          <div className="relative z-10 max-w-2xl">
            <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold text-blue-700 border border-blue-100">
              OWNER WORKSPACE
            </span>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-950">
              Quản lý ngựa, giải đấu và jockey trong một workspace.
            </h1>
            <p className="mt-3 text-base text-slate-600 leading-7">
              Theo dõi hồ sơ ngựa, đăng ký giải, mời jockey và quản lý race entry trước ngày đua.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate('/owner/horses/register')}
                className="rounded-full bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700 transition-colors"
              >
                Tạo hồ sơ ngựa
              </button>
              <button
                type="button"
                onClick={() => navigate('/owner/tournaments')}
                className="rounded-full border border-blue-200 bg-white px-5 py-3 text-sm font-bold text-blue-700 hover:bg-blue-50 transition-colors"
              >
                Xem giải đấu
              </button>
            </div>
          </div>
          <div className="absolute -right-16 -bottom-20 h-64 w-64 rounded-full border-[34px] border-blue-200/50" />
          <div className="absolute right-24 bottom-10 h-24 w-24 rounded-full bg-blue-200/40" />
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Next steps</p>
          <div className="mt-5 space-y-3">
            {quickActions.map((action) => (
              <button
                key={action.to}
                type="button"
                onClick={() => navigate(action.to)}
                className={`w-full text-left rounded-2xl border px-4 py-4 transition-colors ${
                  action.primary
                    ? 'border-blue-200 bg-blue-50 hover:bg-blue-100'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <p className="text-sm font-black text-slate-950">{action.title}</p>
                <p className="mt-1 text-sm text-slate-500 leading-5">{action.description}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Overview
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Luồng công việc Owner</h2>
          </div>
          <button
            type="button"
            onClick={() => navigate('/owner/race-entries')}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Xem race entries
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {overviewCards.map((card) => (
            <article key={card.title} className="rounded-2xl border border-slate-200 bg-white p-6">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                {card.title}
              </p>
              <p className="mt-4 text-3xl font-black text-slate-950">{card.value}</p>
              <p className="mt-3 text-sm text-slate-500 leading-6">{card.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-blue-100 bg-white px-5 py-4">
        <p className="text-sm text-slate-600">
          <span className="font-bold text-blue-700">Gợi ý demo:</span> đăng ký tham gia giải trước,
          sau đó tạo hồ sơ ngựa, đăng ký ngựa vào giải và mời jockey cho ngựa đã được duyệt.
        </p>
      </section>
    </div>
  )
}

export default OwnerDashboard
