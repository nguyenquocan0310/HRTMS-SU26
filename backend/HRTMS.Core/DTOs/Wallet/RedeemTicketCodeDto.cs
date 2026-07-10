using System.ComponentModel.DataAnnotations;

namespace HRTMS.Core.DTOs.Wallet;

/// <summary>Spectator gửi mã vé thưởng để redeem điểm ảo (BR-63 / REQ-F-PRD.5).</summary>
public class RedeemTicketCodeDto
{
    [Required(ErrorMessage = "Vui lòng nhập mã vé thưởng.")]
    [MinLength(4, ErrorMessage = "Mã vé thưởng không hợp lệ.")]
    [MaxLength(64, ErrorMessage = "Mã vé thưởng không hợp lệ.")]
    public string Code { get; set; } = null!;
}

/// <summary>Kết quả redeem: số điểm được cộng và số dư ví sau redeem.</summary>
public class RedeemTicketCodeResponseDto
{
    public int PointsAdded { get; set; }
    public int NewBalance { get; set; }
}
