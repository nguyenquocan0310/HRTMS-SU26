
namespace HRTMS.Core.DTOs.FamilyDeclaration;

public class IndustryUserSearchResultDto
{
    public int UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty; // Owner/Jockey/Referee/Doctor
}