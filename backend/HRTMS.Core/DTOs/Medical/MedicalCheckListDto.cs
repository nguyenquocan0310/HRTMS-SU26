namespace HRTMS.Core.DTOs.Medical;

public class MedicalCheckListDto
{
    public int RaceEntryId { get; set; }

    public int PairingId { get; set; }

    public int? PostPosition { get; set; }

    public string HorseName { get; set; } = string.Empty;

    public string OwnerName { get; set; } = string.Empty;

    public string JockeyName { get; set; } = string.Empty;

    public string RaceEntryStatus { get; set; } = string.Empty;

    public decimal SelfDeclaredWeight { get; set; }

    public decimal? PreRaceWeight { get; set; }

    public string HorseIdentityStatus { get; set; } = string.Empty;

    public string ClinicalStatus { get; set; } = string.Empty;

    // Trạng thái Race (Pre-Race/Live/Unofficial/...) để FE biết khi nào được
    // hiện nút "Khám lại sau trận" (chỉ khi Unofficial).
    public string RaceStatus { get; set; } = string.Empty;

    public string PostRaceClinicalStatus { get; set; } = "Pending";
}