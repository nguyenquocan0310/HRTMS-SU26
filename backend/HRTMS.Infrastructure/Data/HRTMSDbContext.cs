using System;
using System.Collections.Generic;
using HRTMS.Core.Entities;
using Microsoft.EntityFrameworkCore;

namespace HRTMS.Infrastructure.Data;

public partial class HRTMSDbContext : DbContext
{
    public HRTMSDbContext(DbContextOptions<HRTMSDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<AuditLog> AuditLogs { get; set; }

    public virtual DbSet<Certificate> Certificates { get; set; }

    public virtual DbSet<DoctorAssignment> DoctorAssignments { get; set; }

    public virtual DbSet<DoctorProfile> DoctorProfiles { get; set; }

    public virtual DbSet<FamilyRelationshipDeclaration> FamilyRelationshipDeclarations { get; set; }

    public virtual DbSet<Horse> Horses { get; set; }

    public virtual DbSet<HorseTournamentEntry> HorseTournamentEntries { get; set; }

    public virtual DbSet<JockeyProfile> JockeyProfiles { get; set; }

    public virtual DbSet<Notification> Notifications { get; set; }

    public virtual DbSet<OwnerProfile> OwnerProfiles { get; set; }

    public virtual DbSet<Pairing> Pairings { get; set; }

    public virtual DbSet<Prediction> Predictions { get; set; }

    public virtual DbSet<PrizeDistribution> PrizeDistributions { get; set; }

    public virtual DbSet<Protest> Protests { get; set; }

    public virtual DbSet<PursePayout> PursePayouts { get; set; }

    public virtual DbSet<Race> Races { get; set; }

    public virtual DbSet<RaceEntry> RaceEntries { get; set; }

    public virtual DbSet<RaceReport> RaceReports { get; set; }

    public virtual DbSet<RefereeAssignment> RefereeAssignments { get; set; }

    public virtual DbSet<RefereeProfile> RefereeProfiles { get; set; }

    public virtual DbSet<Round> Rounds { get; set; }

    public virtual DbSet<SpectatorProfile> SpectatorProfiles { get; set; }

    public virtual DbSet<TicketRewardCode> TicketRewardCodes { get; set; }

    public virtual DbSet<Tournament> Tournaments { get; set; }

    public virtual DbSet<TournamentParticipant> TournamentParticipants { get; set; }

    public virtual DbSet<User> Users { get; set; }

    public virtual DbSet<Violation> Violations { get; set; }

    public virtual DbSet<VirtualPointsTransaction> VirtualPointsTransactions { get; set; }

    public virtual DbSet<Wallet> Wallets { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.UseCollation("Vietnamese_CI_AS");

        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.ToTable(tb => tb.HasTrigger("trg_AuditLogs_AppendOnly"));

            entity.HasIndex(e => e.ActorId, "IX_AuditLogs_Actor");

            entity.HasIndex(e => e.CreatedAt, "IX_AuditLogs_CreatedAt");

            entity.HasIndex(e => new { e.EntityName, e.EntityId }, "IX_AuditLogs_Entity");

            entity.Property(e => e.Action)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.EntityId)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.EntityName)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.IpAddress)
                .HasMaxLength(45)
                .IsUnicode(false);
            entity.Property(e => e.UserAgent)
                .HasMaxLength(500)
                .IsUnicode(false);

            entity.HasOne(d => d.Actor).WithMany(p => p.AuditLogs)
                .HasForeignKey(d => d.ActorId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_AuditLogs_Actor");
        });
        modelBuilder.Entity<Certificate>(entity =>
        {
            entity.HasKey(e => e.CertificateId);

            entity.HasIndex(e => e.UserId, "UQ_Certificates_UserId").IsUnique();

            entity.Property(e => e.CertificateType)
                .HasMaxLength(20)
                .IsUnicode(false);
            entity.Property(e => e.FileName).HasMaxLength(255);
            entity.Property(e => e.FilePath)
                .HasMaxLength(500)
                .IsUnicode(false);
            entity.Property(e => e.ContentType)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.UploadedAt).HasDefaultValueSql("(getutcdate())");

            entity.HasOne(d => d.User).WithMany(p => p.Certificates)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_Certificates_Users");
        });
        modelBuilder.Entity<DoctorAssignment>(entity =>
        {
            entity.HasKey(e => new { e.RaceId, e.DoctorId });

            entity.HasIndex(e => new { e.RaceId, e.CoiCheckStatus }, "IX_DocAssign_Coi");

            entity.Property(e => e.AssignedAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.CoiCheckStatus)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("NotChecked");
            entity.Property(e => e.CoiViolationReason).HasMaxLength(500);

            entity.HasOne(d => d.Doctor).WithMany(p => p.DoctorAssignments)
                .HasForeignKey(d => d.DoctorId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_DocAssign_Doctor");

            entity.HasOne(d => d.Race).WithMany(p => p.DoctorAssignments)
                .HasForeignKey(d => d.RaceId)
                .HasConstraintName("FK_DocAssign_Race");
        });

        modelBuilder.Entity<DoctorProfile>(entity =>
        {
            entity.HasKey(e => e.DoctorId);

     

            entity.Property(e => e.DoctorId).ValueGeneratedNever();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.MedicalLicenseNumber)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.RejectionReason).HasMaxLength(500);
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("Pending");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getutcdate())");

            entity.HasOne(d => d.Doctor).WithOne(p => p.DoctorProfile)
                .HasForeignKey<DoctorProfile>(d => d.DoctorId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_DoctorProfiles_Users");
        });

        modelBuilder.Entity<FamilyRelationshipDeclaration>(entity =>
        {
            entity.HasKey(e => e.DeclarationId).HasName("PK_FRD");

            entity.HasIndex(e => new { e.RelatedPersonName, e.RelatedDateOfBirth }, "IX_FRD_NameDob").HasFilter("([RelatedDateOfBirth] IS NOT NULL)");

            entity.HasIndex(e => e.RelatedEmailNormalized, "IX_FRD_RelatedEmail").HasFilter("([RelatedEmailNormalized] IS NOT NULL)");

            entity.HasIndex(e => e.RelatedIdentityHash, "IX_FRD_RelatedIdentityHash").HasFilter("([RelatedIdentityHash] IS NOT NULL)");

            entity.HasIndex(e => e.RelatedPhoneNormalized, "IX_FRD_RelatedPhone").HasFilter("([RelatedPhoneNormalized] IS NOT NULL)");

            entity.HasIndex(e => new { e.DeclarantUserId, e.RelatedUserId }, "UQ_FRD_DeclarantRelated")
                .IsUnique()
                .HasFilter("([RelatedUserId] IS NOT NULL)");

            entity.Property(e => e.DeclaredAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.IndustryRole)
                .HasMaxLength(20)
                .IsUnicode(false);
            entity.Property(e => e.MatchConfidence)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("Unresolved");
            entity.Property(e => e.Notes).HasMaxLength(255);
            entity.Property(e => e.RelatedEmailNormalized)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.RelatedIdentityHash).HasMaxLength(32);
            entity.Property(e => e.RelatedPersonName).HasMaxLength(100);
            entity.Property(e => e.RelatedPhoneNormalized)
                .HasMaxLength(20)
                .IsUnicode(false);
            entity.Property(e => e.RelationType)
                .HasMaxLength(20)
                .IsUnicode(false);

            entity.HasOne(d => d.DeclarantUser).WithMany(p => p.FamilyRelationshipDeclarationDeclarantUsers)
                .HasForeignKey(d => d.DeclarantUserId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_FRD_Declarant");

            entity.HasOne(d => d.RelatedUser).WithMany(p => p.FamilyRelationshipDeclarationRelatedUsers)
                .HasForeignKey(d => d.RelatedUserId)
                .HasConstraintName("FK_FRD_Related");
        });

        modelBuilder.Entity<Horse>(entity =>
        {
            entity.HasIndex(e => e.OwnerId, "IX_Horses_Owner");

            entity.Property(e => e.AdminApprovalStatus)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("Pending");
            entity.Property(e => e.Breed)
                .HasMaxLength(30)
                .IsUnicode(false);
            entity.Property(e => e.Color).HasMaxLength(50);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.DopingTestResult)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("Pending");
            entity.Property(e => e.Gender)
                .HasMaxLength(10)
                .IsUnicode(false);
            entity.Property(e => e.IdentifyingMarks).HasMaxLength(255);
            entity.Property(e => e.Name).HasMaxLength(100);
            entity.Property(e => e.Pedigree).HasMaxLength(255);
            entity.Property(e => e.RejectionReason).HasMaxLength(500);
            entity.Property(e => e.ScreeningReason).HasMaxLength(500);
            entity.Property(e => e.ScreeningStatus)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("NotScreened");
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("Declared");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.VaccinationRecordRef)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.Weight).HasColumnType("decimal(6, 2)");

            entity.HasOne(d => d.Owner).WithMany(p => p.Horses)
                .HasForeignKey(d => d.OwnerId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Horses_Owner");
        });

        modelBuilder.Entity<HorseTournamentEntry>(entity =>
        {
            entity.HasKey(e => e.EnrollmentId).HasName("PK_HTE");

            entity.HasIndex(e => e.HorseId, "IX_HTE_Horse");

            entity.HasIndex(e => new { e.TournamentId, e.AdminApprovalStatus }, "IX_HTE_TournamentApproval");

            entity.HasIndex(e => new { e.HorseId, e.TournamentId }, "UQ_HTE_HorseTournament").IsUnique();

            entity.HasIndex(e => new { e.TournamentId, e.HorseId }, "UQ_HTE_TournamentHorse").IsUnique();

            entity.Property(e => e.AdminApprovalStatus)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("Pending");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.RejectionReason).HasMaxLength(500);
            entity.Property(e => e.ScreeningReason).HasMaxLength(500);
            entity.Property(e => e.ScreeningStatus)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("NotScreened");
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("Enrolled");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getutcdate())");

            entity.HasOne(d => d.Horse).WithMany(p => p.TournamentEntries)
                .HasForeignKey(d => d.HorseId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_HTE_Horse");

            entity.HasOne(d => d.Tournament).WithMany(p => p.HorseEntries)
                .HasForeignKey(d => d.TournamentId)
                .HasConstraintName("FK_HTE_Tournament");
        });

        modelBuilder.Entity<JockeyProfile>(entity =>
        {
            entity.HasKey(e => e.JockeyId);

        
            entity.Property(e => e.JockeyId).ValueGeneratedNever();
            entity.Property(e => e.BloodType)
                .HasMaxLength(5)
                .IsUnicode(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.HealthStatus)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("Good");
            entity.Property(e => e.LicenseCertificate)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.RejectionReason).HasMaxLength(500);
            entity.Property(e => e.SelfDeclaredWeight).HasColumnType("decimal(5, 2)");
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("Pending");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getutcdate())");

            entity.HasOne(d => d.Jockey).WithOne(p => p.JockeyProfile)
                .HasForeignKey<JockeyProfile>(d => d.JockeyId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_JockeyProfiles_Users");
        });

        modelBuilder.Entity<Notification>(entity =>
        {
            entity.HasIndex(e => e.IsRead, "IX_Notifications_IsRead");

            entity.HasIndex(e => e.RecipientId, "IX_Notifications_Recipient");

            entity.Property(e => e.RelatedEntityType)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.SentAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.Title).HasMaxLength(150);
            entity.Property(e => e.Type)
                .HasMaxLength(20)
                .IsUnicode(false);

            entity.HasOne(d => d.Recipient).WithMany(p => p.Notifications)
                .HasForeignKey(d => d.RecipientId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Notifications_Recipient");
        });

        modelBuilder.Entity<OwnerProfile>(entity =>
        {
            entity.HasKey(e => e.OwnerId);

            entity.Property(e => e.OwnerId).ValueGeneratedNever();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getutcdate())");

            entity.HasOne(d => d.Owner).WithOne(p => p.OwnerProfile)
                .HasForeignKey<OwnerProfile>(d => d.OwnerId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_OwnerProfiles_Users");
        });

        modelBuilder.Entity<Pairing>(entity =>
        {
            entity.HasIndex(e => e.HorseId, "IX_Pairings_Horse");

            entity.HasIndex(e => e.JockeyId, "IX_Pairings_Jockey");

            entity.HasIndex(e => e.TournamentId, "IX_Pairings_Tournament");

            entity.HasIndex(e => new { e.TournamentId, e.HorseId }, "IX_Pairings_TournamentHorse");

            entity.HasIndex(e => new { e.TournamentId, e.JockeyId }, "IX_Pairings_TournamentJockey");

            entity.HasIndex(e => new { e.TournamentId, e.Status }, "IX_Pairings_TournamentStatus");

            entity.HasIndex(e => new { e.TournamentId, e.HorseId }, "UQ_Pairings_ActiveHorseTournament")
                .IsUnique()
                .HasFilter("([Status] IN ('Pending', 'Accepted', 'Confirmed'))");

            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.RequestMessage).HasMaxLength(255);
            entity.Property(e => e.ResponseReason).HasMaxLength(255);
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("Pending");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getutcdate())");

            entity.HasOne(d => d.Horse).WithMany(p => p.PairingHorses)
                .HasForeignKey(d => d.HorseId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Pairings_Horse");

            entity.HasOne(d => d.Jockey).WithMany(p => p.Pairings)
                .HasForeignKey(d => d.JockeyId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Pairings_Jockey");

            entity.HasOne(d => d.Tournament).WithMany(p => p.Pairings)
                .HasForeignKey(d => d.TournamentId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Pairings_Tournament");

            // FK_Pairings_HorseTournament (TournamentId, HorseId) → HorseTournamentEntries
            // được enforce ở DB-level (patch 001). EF không cần model lại quan hệ composite này.

            entity.HasOne(d => d.TournamentParticipant).WithMany(p => p.Pairings)
                .HasPrincipalKey(p => new { p.TournamentId, p.UserId })
                .HasForeignKey(d => new { d.TournamentId, d.JockeyId })
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Pairings_JockeyRoster");
        });

        modelBuilder.Entity<Prediction>(entity =>
        {
            entity.HasIndex(e => e.RaceId, "IX_Predictions_Race");

            entity.HasIndex(e => e.SpectatorId, "IX_Predictions_Spectator");

            entity.HasIndex(e => new { e.SpectatorId, e.RaceEntryId, e.PredictionType }, "UQ_Predictions_SpectatorEntry").IsUnique();

            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.PredictionType)
                .HasMaxLength(10)
                .IsUnicode(false);
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("Pending");

            entity.HasOne(d => d.RaceEntry).WithMany(p => p.Predictions)
                .HasForeignKey(d => d.RaceEntryId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Predictions_RaceEntry");

            entity.HasOne(d => d.Race).WithMany(p => p.Predictions)
                .HasForeignKey(d => d.RaceId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Predictions_Race");

            entity.HasOne(d => d.Spectator).WithMany(p => p.Predictions)
                .HasForeignKey(d => d.SpectatorId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Predictions_Spectator");
        });

        modelBuilder.Entity<PrizeDistribution>(entity =>
        {
            entity.HasIndex(e => e.TournamentId, "IX_PrizeDist_Tournament");

            entity.HasIndex(e => new { e.TournamentId, e.Position }, "UQ_PrizeDist_TourPos").IsUnique();

            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.Percentage).HasColumnType("decimal(5, 2)");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getutcdate())");

            entity.HasOne(d => d.Tournament).WithMany(p => p.PrizeDistributions)
                .HasForeignKey(d => d.TournamentId)
                .HasConstraintName("FK_PrizeDist_Tournament");
        });

        modelBuilder.Entity<Protest>(entity =>
        {
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.PenaltyApplied)
                .HasMaxLength(20)
                .IsUnicode(false);
            entity.Property(e => e.RefereeDecision).HasMaxLength(500);
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("Pending");
            entity.Property(e => e.SubmittedAt).HasDefaultValueSql("(getutcdate())");

            entity.HasOne(d => d.AccusedRaceEntry).WithMany(p => p.Protests)
                .HasForeignKey(d => d.AccusedRaceEntryId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Protests_AccusedEntry");

            entity.HasOne(d => d.Race).WithMany(p => p.Protests)
                .HasForeignKey(d => d.RaceId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Protests_Race");

            entity.HasOne(d => d.SubmittedByUser).WithMany(p => p.Protests)
                .HasForeignKey(d => d.SubmittedByUserId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Protests_SubmittedBy");

            entity.HasOne(d => d.Violation).WithMany(p => p.Protests)
                .HasForeignKey(d => d.ViolationId)
                .HasConstraintName("FK_Protests_Violation");
        });

        modelBuilder.Entity<PursePayout>(entity =>
        {
            entity.Property(e => e.CalculatedAmount).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.PayoutStatus)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("Unpaid");
            entity.Property(e => e.Role)
                .HasMaxLength(20)
                .IsUnicode(false);
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getutcdate())");

            entity.HasOne(d => d.RaceEntry).WithMany(p => p.PursePayouts)
                .HasForeignKey(d => d.RaceEntryId)
                .HasConstraintName("FK_PursePayouts_RaceEntry");

            entity.HasOne(d => d.RecipientUser).WithMany(p => p.PursePayoutRecipientUsers)
                .HasForeignKey(d => d.RecipientUserId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_PursePayouts_Recipient");

            entity.HasOne(d => d.UpdatedByAdmin).WithMany(p => p.PursePayoutUpdatedByAdmins)
                .HasForeignKey(d => d.UpdatedByAdminId)
                .HasConstraintName("FK_PursePayouts_Admin");
        });

        modelBuilder.Entity<Race>(entity =>
        {
            entity.HasIndex(e => e.RoundId, "IX_Races_Round");

            entity.HasIndex(e => e.Status, "IX_Races_Status");

            entity.HasIndex(e => new { e.RoundId, e.RaceNumber }, "UQ_Races_RoundNumber").IsUnique();

            entity.Property(e => e.ConfirmationCutoffHours).HasDefaultValue(24);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.ProtestDeadlineMinutes).HasDefaultValue(120);
            entity.Property(e => e.PurseAmount).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("Upcoming");
            entity.Property(e => e.TrackTypeOverride)
                .HasMaxLength(20)
                .IsUnicode(false);
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getutcdate())");
            // Concurrency token do DB sinh (ROWVERSION) — xem patch 005.
            entity.Property(e => e.RowVersion).IsRowVersion();

            entity.HasOne(d => d.Round).WithMany(p => p.Races)
                .HasForeignKey(d => d.RoundId)
                .HasConstraintName("FK_Races_Round");
        });

        modelBuilder.Entity<RaceEntry>(entity =>
        {
            entity.HasIndex(e => e.IndependenceCheckStatus, "IX_RaceEntries_Independence");

            entity.HasIndex(e => e.PairingId, "IX_RaceEntries_Pairing");

            entity.HasIndex(e => e.RaceId, "IX_RaceEntries_Race");

            entity.HasIndex(e => e.Status, "IX_RaceEntries_Status");

            entity.HasIndex(e => new { e.RaceId, e.PostPosition }, "UQ_RaceEntries_PostPosition")
                .IsUnique()
                .HasFilter("([PostPosition] IS NOT NULL)");

            entity.HasIndex(e => new { e.RaceId, e.PairingId }, "UQ_RaceEntries_RacePairing").IsUnique();

            entity.Property(e => e.AdvancementStatus)
                .HasMaxLength(20)
                .IsUnicode(false);
            entity.Property(e => e.AdvancementReason).HasMaxLength(255);
            entity.Property(e => e.ClinicalStatus)
                .HasMaxLength(20)
                .IsUnicode(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.EarningsAwarded).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.EntryFeeStatus)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("Unpaid");
            entity.Property(e => e.FinishTime).HasColumnType("decimal(8, 3)");
            entity.Property(e => e.HorseIdentityCheckStatus)
                .HasMaxLength(20)
                .IsUnicode(false);
            entity.Property(e => e.IndependenceCheckStatus)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("NotChecked");
            entity.Property(e => e.IndependenceViolationReason).HasMaxLength(500);
            entity.Property(e => e.PostRaceJockeyWeight).HasColumnType("decimal(5, 2)");
            entity.Property(e => e.PreRaceJockeyWeight).HasColumnType("decimal(5, 2)");
            entity.Property(e => e.Status)
                .HasMaxLength(30)
                .IsUnicode(false)
                .HasDefaultValue("Pending");
            entity.Property(e => e.UnfitReason).HasMaxLength(255);
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.WithdrawalReason).HasMaxLength(255);
            // Concurrency token do DB sinh (ROWVERSION) — xem patch 005.
            entity.Property(e => e.RowVersion).IsRowVersion();

            entity.HasOne(d => d.ClinicalCheckedByDoctor).WithMany(p => p.RaceEntryClinicalCheckedByDoctors)
                .HasForeignKey(d => d.ClinicalCheckedByDoctorId)
                .HasConstraintName("FK_RaceEntries_ClinicalDoctor");

            entity.HasOne(d => d.EntryFeeConfirmedByNavigation).WithMany(p => p.RaceEntries)
                .HasForeignKey(d => d.EntryFeeConfirmedBy)
                .HasConstraintName("FK_RaceEntries_FeeConfirmedBy");

            entity.HasOne(d => d.HorseIdentityCheckedByDoctor).WithMany(p => p.RaceEntryHorseIdentityCheckedByDoctors)
                .HasForeignKey(d => d.HorseIdentityCheckedByDoctorId)
                .HasConstraintName("FK_RaceEntries_HorseIdentityDoctor");

            entity.HasOne(d => d.IndependenceCheckedByReferee).WithMany(p => p.RaceEntries)
                .HasForeignKey(d => d.IndependenceCheckedByRefereeId)
                .HasConstraintName("FK_RaceEntries_IndependenceReferee");

            entity.HasOne(d => d.Pairing).WithMany(p => p.RaceEntries)
                .HasForeignKey(d => d.PairingId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_RaceEntries_Pairing");

            entity.HasOne(d => d.PostRaceWeightByDoctor).WithMany(p => p.RaceEntryPostRaceWeightByDoctors)
                .HasForeignKey(d => d.PostRaceWeightByDoctorId)
                .HasConstraintName("FK_RaceEntries_PostDoctor");

            entity.HasOne(d => d.PreRaceWeightByDoctor).WithMany(p => p.RaceEntryPreRaceWeightByDoctors)
                .HasForeignKey(d => d.PreRaceWeightByDoctorId)
                .HasConstraintName("FK_RaceEntries_PreDoctor");

            entity.HasOne(d => d.Race).WithMany(p => p.RaceEntries)
                .HasForeignKey(d => d.RaceId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_RaceEntries_Race");
        });

        modelBuilder.Entity<RaceReport>(entity =>
        {
            entity.ToTable(tb => tb.HasTrigger("trg_RaceReports_Immutable"));

            entity.HasIndex(e => e.RaceId, "UQ_RaceReports_Race").IsUnique();

            entity.Property(e => e.SubmittedAt).HasDefaultValueSql("(getutcdate())");

            entity.HasOne(d => d.LeadReferee).WithMany(p => p.RaceReports)
                .HasForeignKey(d => d.LeadRefereeId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_RaceReports_LeadReferee");

            entity.HasOne(d => d.Race).WithOne(p => p.RaceReport)
                .HasForeignKey<RaceReport>(d => d.RaceId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_RaceReports_Race");
        });

        modelBuilder.Entity<RefereeAssignment>(entity =>
        {
            entity.HasKey(e => new { e.RaceId, e.RefereeId });

            entity.HasIndex(e => new { e.RaceId, e.CoiCheckStatus }, "IX_RefAssign_Coi");

            entity.HasIndex(e => e.RaceId, "UQ_RefereeAssignments_LeadReferee")
                .IsUnique()
                .HasFilter("([Role]='Lead Referee')");

            entity.Property(e => e.AssignedAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.CoiCheckStatus)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("NotChecked");
            entity.Property(e => e.CoiViolationReason).HasMaxLength(500);
            entity.Property(e => e.Role)
                .HasMaxLength(30)
                .IsUnicode(false);

            entity.HasOne(d => d.Race).WithOne(p => p.RefereeAssignment)
                .HasForeignKey<RefereeAssignment>(d => d.RaceId)
                .HasConstraintName("FK_RefAssign_Race");

            entity.HasOne(d => d.Referee).WithMany(p => p.RefereeAssignments)
                .HasForeignKey(d => d.RefereeId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_RefAssign_Referee");
        });

        modelBuilder.Entity<RefereeProfile>(entity =>
        {
            entity.HasKey(e => e.RefereeId);

            entity.Property(e => e.RefereeId).ValueGeneratedNever();
            entity.Property(e => e.CertificationLevel)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.RejectionReason).HasMaxLength(500);
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("Pending");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getutcdate())");

            entity.HasOne(d => d.Referee).WithOne(p => p.RefereeProfile)
                .HasForeignKey<RefereeProfile>(d => d.RefereeId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_RefereeProfiles_Users");
        });

        modelBuilder.Entity<Round>(entity =>
        {
            entity.HasIndex(e => e.TournamentId, "IX_Rounds_Tournament");

            entity.HasIndex(e => new { e.TournamentId, e.SequenceOrder }, "UQ_Rounds_TourSeq").IsUnique();

            entity.Property(e => e.Name).HasMaxLength(100);
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("Upcoming");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getutcdate())");

            entity.HasOne(d => d.Tournament).WithMany(p => p.Rounds)
                .HasForeignKey(d => d.TournamentId)
                .HasConstraintName("FK_Rounds_Tournament");
        });

        modelBuilder.Entity<SpectatorProfile>(entity =>
        {
            entity.HasKey(e => e.SpectatorId);

            entity.Property(e => e.SpectatorId).ValueGeneratedNever();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getutcdate())");

            entity.HasOne(d => d.Spectator).WithOne(p => p.SpectatorProfile)
                .HasForeignKey<SpectatorProfile>(d => d.SpectatorId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_SpectatorProfiles_Users");
        });

        modelBuilder.Entity<TicketRewardCode>(entity =>
        {
            entity.HasIndex(e => e.RedeemedBySpectatorId, "IX_TicketRewardCodes_RedeemedBy").HasFilter("([RedeemedBySpectatorId] IS NOT NULL)");

            entity.HasIndex(e => new { e.Status, e.ExpiresAt }, "IX_TicketRewardCodes_Status");

            entity.HasIndex(e => e.CodeHash, "UQ_TicketRewardCodes_CodeHash").IsUnique();

            entity.Property(e => e.CodeHash).HasMaxLength(32);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("Active");

            entity.HasOne(d => d.RedeemedBySpectator).WithMany(p => p.TicketRewardCodes)
                .HasForeignKey(d => d.RedeemedBySpectatorId)
                .HasConstraintName("FK_TicketRewardCodes_RedeemedBy");
        });

        modelBuilder.Entity<Tournament>(entity =>
        {
            entity.HasIndex(e => e.Status, "IX_Tournaments_Status");

            entity.Property(e => e.AdvancementRule)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("TopPerRace");
            entity.Property(e => e.AdvancementCount).HasDefaultValue(5);
            entity.Property(e => e.AllowedBreed)
                .HasMaxLength(30)
                .IsUnicode(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.EntryFeeAmount).HasColumnType("decimal(10, 2)");
            entity.Property(e => e.Name).HasMaxLength(150);
            entity.Property(e => e.PostRaceWeightDiffThresholdKg)
                .HasDefaultValue(1.00m)
                .HasColumnType("decimal(4, 2)");
            entity.Property(e => e.PreRaceWeightThresholdKg)
                .HasDefaultValue(2.00m)
                .HasColumnType("decimal(4, 2)");
            entity.Property(e => e.PurseAmount).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.RaceCategory)
                .HasMaxLength(20)
                .IsUnicode(false);
            entity.Property(e => e.Status)
                .HasMaxLength(30)
                .IsUnicode(false)
                .HasDefaultValue("Draft");
            entity.Property(e => e.TrackType)
                .HasMaxLength(20)
                .IsUnicode(false);
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getutcdate())");

            entity.HasOne(d => d.CreatedByNavigation).WithMany(p => p.Tournaments)
                .HasForeignKey(d => d.CreatedBy)
                .HasConstraintName("FK_Tournaments_CreatedBy");
        });

        modelBuilder.Entity<TournamentParticipant>(entity =>
        {
            entity.HasKey(e => e.ParticipantId);

            entity.HasIndex(e => new { e.TournamentId, e.Role, e.Status }, "IX_TP_Roster");

            entity.HasIndex(e => new { e.TournamentId, e.UserId, e.Status }, "IX_TP_TournamentUserStatus");

            entity.HasIndex(e => e.UserId, "IX_TP_User");

            entity.HasIndex(e => new { e.TournamentId, e.UserId }, "UQ_TP_TourUser").IsUnique();

            entity.Property(e => e.RegisteredAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.RejectionReason).HasMaxLength(500);
            entity.Property(e => e.Role)
                .HasMaxLength(20)
                .IsUnicode(false);
            entity.Property(e => e.ScreeningReason).HasMaxLength(500);
            entity.Property(e => e.ScreeningStatus)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("NotScreened");
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("Pending");

            entity.HasOne(d => d.ApprovedByNavigation).WithMany(p => p.TournamentParticipantApprovedByNavigations)
                .HasForeignKey(d => d.ApprovedBy)
                .HasConstraintName("FK_TP_ApprovedBy");

            entity.HasOne(d => d.Tournament).WithMany(p => p.TournamentParticipants)
                .HasForeignKey(d => d.TournamentId)
                .HasConstraintName("FK_TP_Tournament");

            entity.HasOne(d => d.User).WithMany(p => p.TournamentParticipantUsers)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_TP_User");
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(e => e.IdentityHash, "IX_Users_IdentityHash").HasFilter("([IdentityHash] IS NOT NULL)");

            entity.HasIndex(e => e.NormalizedPhone, "IX_Users_NormalizedPhone").HasFilter("([NormalizedPhone] IS NOT NULL)");

            entity.HasIndex(e => e.Role, "IX_Users_Role");

            entity.HasIndex(e => e.Status, "IX_Users_Status");

            entity.HasIndex(e => e.Email, "UQ_Users_Email").IsUnique();

            entity.HasIndex(e => e.NormalizedEmail, "UQ_Users_NormalizedEmail").IsUnique();

            entity.HasIndex(e => e.Username, "UQ_Users_Username").IsUnique();

            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.Email)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.FullName).HasMaxLength(100);
            entity.Property(e => e.IdentityHash).HasMaxLength(32);
            entity.Property(e => e.IdentityNumberEncrypted).HasMaxLength(512);
            entity.Property(e => e.NormalizedEmail)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.NormalizedPhone)
                .HasMaxLength(20)
                .IsUnicode(false);
            entity.Property(e => e.PasswordHash)
                .HasMaxLength(255)
                .IsUnicode(false);
            entity.Property(e => e.PhoneNumber)
                .HasMaxLength(20)
                .IsUnicode(false);
            entity.Property(e => e.Role)
                .HasMaxLength(20)
                .IsUnicode(false);
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("Active");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.Username)
                .HasMaxLength(50)
                .IsUnicode(false);
        });

        modelBuilder.Entity<Violation>(entity =>
        {
            entity.Property(e => e.Description).HasMaxLength(255);
            entity.Property(e => e.LoggedAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.Penalty)
                .HasMaxLength(20)
                .IsUnicode(false);
            entity.Property(e => e.ViolationCode)
                .HasMaxLength(15)
                .IsUnicode(false);

            entity.HasOne(d => d.PlaceBehindEntry).WithMany(p => p.ViolationPlaceBehindEntries)
                .HasForeignKey(d => d.PlaceBehindEntryId)
                .HasConstraintName("FK_Violations_PlaceBehind");

            entity.HasOne(d => d.RaceEntry).WithMany(p => p.ViolationRaceEntries)
                .HasForeignKey(d => d.RaceEntryId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Violations_RaceEntry");

            entity.HasOne(d => d.RaceReport).WithMany(p => p.Violations)
                .HasForeignKey(d => d.RaceReportId)
                .HasConstraintName("FK_Violations_RaceReport");
        });

        modelBuilder.Entity<VirtualPointsTransaction>(entity =>
        {
            entity.HasKey(e => e.TransactionId).HasName("PK_VPT");

            entity.HasIndex(e => e.Type, "IX_VPT_Type");

            entity.HasIndex(e => e.WalletId, "IX_VPT_Wallet");

            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.ReferenceId)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.ReferenceType)
                .HasMaxLength(30)
                .IsUnicode(false);
            entity.Property(e => e.Type)
                .HasMaxLength(30)
                .IsUnicode(false);

            entity.HasOne(d => d.Wallet).WithMany(p => p.VirtualPointsTransactions)
                .HasForeignKey(d => d.WalletId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_VPT_Wallet");
        });

        modelBuilder.Entity<Wallet>(entity =>
        {
            entity.HasIndex(e => e.SpectatorId, "UQ_Wallets_Spectator").IsUnique();

            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getutcdate())");

            entity.HasOne(d => d.Spectator).WithOne(p => p.Wallet)
                .HasForeignKey<Wallet>(d => d.SpectatorId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Wallets_Spectator");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
