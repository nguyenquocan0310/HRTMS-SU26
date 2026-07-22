using System;
using System.Collections.Generic;
using System.Linq;

namespace HRTMS.Core.DTOs.LiveRace;

/// <summary>
/// Danh mục mã vi phạm dùng chung cho API và dropdown của Referee Console.
/// Giữ ở BE để client không thể gửi mã tự do ngoài danh mục đã công bố.
/// </summary>
public static class ViolationCodeCatalog
{
    private static readonly IReadOnlyList<ViolationCodeOptionDto> Codes = new List<ViolationCodeOptionDto>
    {
        new() { Code = "INT-001", Name = "Interference", Description = "Cản trở hoặc chèn ép ngựa khác." },
        new() { Code = "LANE-001", Name = "Lane deviation", Description = "Đổi làn nguy hiểm hoặc không giữ đúng làn chạy." },
        new() { Code = "WHIP-001", Name = "Improper whip use", Description = "Sử dụng roi không đúng quy định." },
        new() { Code = "FALSE-001", Name = "False start", Description = "Xuất phát sai hoặc gây xuất phát lại." },
        new() { Code = "GEAR-001", Name = "Unsafe equipment", Description = "Trang thiết bị không an toàn hoặc không đúng quy định." },
        new() { Code = "WEIGHT-001", Name = "Weight irregularity", Description = "Sai lệch cân nặng cần trọng tài xem xét." },
        new() { Code = "DNF-001", Name = "Did not finish", Description = "Ngựa đã xuất phát nhưng bỏ cuộc trong lúc race Live." },
        new() { Code = "CONDUCT-001", Name = "Dangerous riding", Description = "Điều khiển ngựa nguy hiểm hoặc phi thể thao." }
    };

    public static IReadOnlyList<ViolationCodeOptionDto> All => Codes;

    public static bool Contains(string? code) =>
        !string.IsNullOrWhiteSpace(code) &&
        Codes.Any(item => item.Code.Equals(code.Trim(), StringComparison.OrdinalIgnoreCase));
}

public class ViolationCodeOptionDto
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}
