using System;
using System.Collections.Generic;

namespace HRTMS.Core.DTOs.Prediction;

// ====== PRD.1 — Admin cấu hình / đóng-mở cổng dự đoán ======
public class PredictionGateConfigDto
{
    public bool IsPredictionGateClosed { get; set; }
}

// ====== PRD.4 — Form Score (SQL thuần 40/35/25) ======
public class FormScoreDto
{
    public int RaceEntryId { get; set; }
    public int HorseId { get; set; }
    public string HorseName { get; set; } = null!;
    public int JockeyId { get; set; }
    public string JockeyName { get; set; } = null!;
    public decimal HorseHistoryScore { get; set; }   // 40%
    public decimal JockeyHistoryScore { get; set; }  // 35%
    public decimal RoundTypeAvgScore { get; set; }   // 25%
    public decimal FormScore { get; set; }           // tổng có trọng số
}

// ====== PRD.5 — Đặt dự đoán ======
public class PlacePredictionDto
{
    public int RaceId { get; set; }
    public int RaceEntryId { get; set; }
    public int PointsPlaced { get; set; }
}

public class PredictionResponseDto
{
    public int PredictionId { get; set; }
    public int RaceId { get; set; }
    public int RaceEntryId { get; set; }
    public string PredictionType { get; set; } = null!;
    public int PointsPlaced { get; set; }
    public string Status { get; set; } = null!;
    public int? PointsAwarded { get; set; }
    public DateTime CreatedAt { get; set; }
    public int WalletBalanceAfter { get; set; }
}

// Trạng thái cổng để Spectator/UI kiểm tra trước khi gọi đặt dự đoán (UI-S33)
public class PredictionGateStatusDto
{
    public int RaceId { get; set; }
    public bool IsPostPositionDrawn { get; set; }
    public bool IsPredictionGateClosed { get; set; }
    public string RaceStatus { get; set; } = null!;
    public bool CanPredict { get; set; }
}