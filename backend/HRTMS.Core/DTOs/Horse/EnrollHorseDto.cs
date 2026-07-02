using System.ComponentModel.DataAnnotations;

namespace HRTMS.Core.DTOs.Horse
{
    /// <summary>
    /// Owner "đẩy" một con ngựa trong kho vào một giải cụ thể.
    /// HorseId lấy từ route; chỉ cần chọn giải để enroll.
    /// </summary>
    public class EnrollHorseDto
    {
        [Required]
        [Range(1, int.MaxValue, ErrorMessage = "Phải chọn giải đấu hợp lệ để đẩy ngựa vào.")]
        public int TournamentId { get; set; }
    }
}
