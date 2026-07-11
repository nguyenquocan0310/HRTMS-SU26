namespace HRTMS.Core.DTOs.Leaderboard;

public class HorseLeaderboardEntryDto
{
    public int HorseId { get; set; }
    public string? HorseName { get; set; }
    public int Races { get; set; }
    public int Wins { get; set; }
    public int TotalPoints { get; set; }
    public decimal TotalEarnings { get; set; }
    public double WinRate { get; set; }
    public int Rank { get; set; }
}

public class JockeyLeaderboardEntryDto
{
    public int JockeyId { get; set; }
    public string? JockeyName { get; set; }
    public int Races { get; set; }
    public int Wins { get; set; }
    public int TotalPoints { get; set; }
    public decimal TotalEarnings { get; set; }
    public double WinRate { get; set; }
    public int Rank { get; set; }
}

// LDR.3 — mode=points|earnings, dùng string const để tương thích query string
// và dễ validate ở controller (LeaderboardMode.IsValid).
public static class LeaderboardMode
{
    public const string Points = "points";
    public const string Earnings = "earnings";

    public static bool IsValid(string mode) =>
        mode == Points || mode == Earnings;
}