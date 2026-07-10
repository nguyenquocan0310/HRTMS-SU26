using System.ComponentModel.DataAnnotations;

namespace HRTMS.Core.DTOs.Wallet;

/// <summary>Admin tạo batch mã vé thưởng (BR-63). Raw code chỉ trả về một lần trong response.</summary>
public class CreateTicketCodesDto
{
    [Range(1, 1000, ErrorMessage = "Số lượng mã phải từ 1 đến 1000.")]
    public int Quantity { get; set; }

    [Range(1, int.MaxValue, ErrorMessage = "Điểm thưởng phải lớn hơn 0.")]
    public int RewardAmount { get; set; }

    [Required(ErrorMessage = "Vui lòng nhập thời điểm hết hạn.")]
    public DateTime ExpiresAt { get; set; }
}

/// <summary>
/// Kết quả tạo batch. `Codes` là raw code — CHỈ trả một lần tại đây;
/// DB chỉ lưu SHA-256 hash, không có API nào lấy lại raw code sau này.
/// </summary>
public class CreateTicketCodesResponseDto
{
    public int Count { get; set; }
    public int RewardAmount { get; set; }
    public DateTime ExpiresAt { get; set; }
    public List<string> Codes { get; set; } = new();
}
