import React, { useState } from 'react';
import type { JockeyInvitation } from '../../types/owner.types';

// Mock data
const mockInvitations: JockeyInvitation[] = [
  {
    invitationID: 'inv-001',
    raceID: 'race-001',
    ownerID: 'owner-001',
    jockeyID: 'jockey-001',
    jockeyName: 'Nguyễn Văn A',
    status: 'Pending',
    invitedAt: new Date('2024-06-10'),
  },
  {
    invitationID: 'inv-002',
    raceID: 'race-002',
    ownerID: 'owner-001',
    jockeyID: 'jockey-002',
    jockeyName: 'Trần Thị B',
    status: 'Accept',
    invitedAt: new Date('2024-06-08'),
    respondedAt: new Date('2024-06-09'),
  },
  {
    invitationID: 'inv-003',
    raceID: 'race-003',
    ownerID: 'owner-001',
    jockeyID: 'jockey-003',
    jockeyName: 'Phạm Văn C',
    status: 'Decline',
    invitedAt: new Date('2024-06-05'),
    respondedAt: new Date('2024-06-06'),
  },
];

export default function JockeyInvite() {
  const [invitations, setInvitations] = useState<JockeyInvitation[]>(mockInvitations);
  const [showModal, setShowModal] = useState(false);
  const [jockeyName, setJockeyName] = useState('');
  const [selectedRaceID, setSelectedRaceID] = useState('');
  const [error, setError] = useState('');

  const getStatusColor = (status: JockeyInvitation['status']): string => {
    switch (status) {
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'Accept':
        return 'bg-green-100 text-green-800';
      case 'Decline':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleSendInvitation = () => {
    setError('');

    if (!jockeyName.trim()) {
      setError('Vui lòng nhập tên jockey');
      return;
    }

    if (!selectedRaceID.trim()) {
      setError('Vui lòng chọn cuộc đua');
      return;
    }

    // Create new invitation
    const newInvitation: JockeyInvitation = {
      invitationID: `inv-${Date.now()}`,
      raceID: selectedRaceID,
      ownerID: 'owner-001',
      jockeyID: `jockey-${Date.now()}`,
      jockeyName: jockeyName,
      status: 'Pending',
      invitedAt: new Date(),
    };

    setInvitations((prev) => [newInvitation, ...prev]);
    setJockeyName('');
    setSelectedRaceID('');
    setShowModal(false);
  };

  const handleConfirmPairing = (invitationID: string) => {
    // Mock confirm pairing
    setInvitations((prev) =>
      prev.map((inv) =>
        inv.invitationID === invitationID
          ? { ...inv, status: 'Accept' as const, respondedAt: new Date() }
          : inv
      )
    );
  };

  // Empty state
  if (invitations.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🤝</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Chưa có lời mời jockey nào
          </h2>
          <p className="text-gray-600 mb-6">
            Hãy gửi lời mời cho jockey để tham gia cuộc đua.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
            Gửi lời mời mới
          </button>

          {/* Send Invitation Modal */}
          {showModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
                <h3 className="text-lg font-bold text-gray-800 mb-4">
                  Gửi lời mời cho jockey
                </h3>

                {error && (
                  <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                )}

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tên jockey
                    </label>
                    <input
                      type="text"
                      value={jockeyName}
                      onChange={(e) => setJockeyName(e.target.value)}
                      placeholder="Nhập tên jockey"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ID Cuộc đua
                    </label>
                    <input
                      type="text"
                      value={selectedRaceID}
                      onChange={(e) => setSelectedRaceID(e.target.value)}
                      placeholder="Nhập ID cuộc đua"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setError('');
                      setJockeyName('');
                      setSelectedRaceID('');
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleSendInvitation}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Gửi lời mời
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // List state
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Lời mời jockey
            </h1>
            <p className="text-gray-600">
              Quản lý các lời mời gửi cho jockey
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
          >
            <span>+</span> Gửi lời mời mới
          </button>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              {/* Table Header */}
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Tên jockey
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    ID Cuộc đua
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Trạng thái
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Ngày mời
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Hành động
                  </th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-gray-200">
                {invitations.map((invitation) => (
                  <tr key={invitation.invitationID} className="hover:bg-gray-50 transition-colors">
                    {/* Jockey Name */}
                    <td className="px-6 py-4 text-sm text-gray-800 font-medium">
                      {invitation.jockeyName || 'N/A'}
                    </td>

                    {/* Race ID */}
                    <td className="px-6 py-4 text-sm text-gray-800">
                      {invitation.raceID}
                    </td>

                    {/* Status Badge */}
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          invitation.status
                        )}`}
                      >
                        {invitation.status === 'Pending' && 'Chờ phản hồi'}
                        {invitation.status === 'Accept' && 'Đã chấp nhận'}
                        {invitation.status === 'Decline' && 'Đã từ chối'}
                      </span>
                    </td>

                    {/* Invited Date */}
                    <td className="px-6 py-4 text-sm text-gray-800">
                      {new Date(invitation.invitedAt).toLocaleDateString('vi-VN')}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {invitation.status === 'Accept' && (
                          <button
                            onClick={() => handleConfirmPairing(invitation.invitationID)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md transition-colors"
                          >
                            Xác nhận ghép cặp
                          </button>
                        )}

                        {invitation.status === 'Pending' && (
                          <span className="text-xs text-gray-600">
                            Chờ jockey phản hồi
                          </span>
                        )}

                        {invitation.status === 'Decline' && (
                          <span className="text-xs text-red-600 font-medium">
                            Jockey đã từ chối
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Send Invitation Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-bold text-gray-800 mb-4">
                Gửi lời mời cho jockey
              </h3>

              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tên jockey
                  </label>
                  <input
                    type="text"
                    value={jockeyName}
                    onChange={(e) => setJockeyName(e.target.value)}
                    placeholder="Nhập tên jockey"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ID Cuộc đua
                  </label>
                  <input
                    type="text"
                    value={selectedRaceID}
                    onChange={(e) => setSelectedRaceID(e.target.value)}
                    placeholder="Nhập ID cuộc đua"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setError('');
                    setJockeyName('');
                    setSelectedRaceID('');
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSendInvitation}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  Gửi lời mời
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
