using System.ComponentModel.DataAnnotations;

namespace HRTMS.Core.DTOs.Wallet;

/// <summary>Admin tạo batch mã vé thưởng (BR-63).</summary>
public class CreateTicketCodesDto
{
    [Range(1, 1000, ErrorMessage = "Số lượng mã phải từ 1 đến 1000.")]
    public int Quantity { get; set; }

    [Range(1, int.MaxValue, ErrorMessage = "Điểm thưởng phải lớn hơn 0.")]
    public int RewardAmount { get; set; }

    [Required(ErrorMessage = "Vui lòng nhập thời điểm hết hạn.")]
    public DateTime ExpiresAt { get; set; }
}

/// <summary>Kết quả tạo batch. `Codes` là danh sách mã vừa sinh.</summary>
public class CreateTicketCodesResponseDto
{
    public int Count { get; set; }
    public int RewardAmount { get; set; }
    public DateTime ExpiresAt { get; set; }
    public List<string> Codes { get; set; } = new();
}

/// <summary>Một dòng trong danh sách mã vé thưởng đã tạo (admin xem lại).</summary>
public class TicketCodeListItemDto
{
    public int Id { get; set; }
    public string Code { get; set; } = null!;
    public int PointAmount { get; set; }

    /// <summary>Active | Redeemed | Expired (Expired suy ra lúc chạy khi Active nhưng đã quá hạn).</summary>
    public string Status { get; set; } = null!;

    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; }

    public string? RedeemedBySpectatorName { get; set; }
    public DateTime? RedeemedAt { get; set; }
}

/// <summary>Danh sách mã vé thưởng có phân trang.</summary>
public class TicketCodeListResponseDto
{
    public List<TicketCodeListItemDto> Items { get; set; } = new();
    public int Total { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}
