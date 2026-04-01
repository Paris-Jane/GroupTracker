using Microsoft.EntityFrameworkCore;
using ProjectHub.API.Models;
using TaskStatus = ProjectHub.API.Models.TaskStatus;

namespace ProjectHub.API.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<GroupMember> GroupMembers => Set<GroupMember>();
    public DbSet<TaskItem> TaskItems => Set<TaskItem>();
    public DbSet<Subtask> Subtasks => Set<Subtask>();
    public DbSet<TaskAssignment> TaskAssignments => Set<TaskAssignment>();
    public DbSet<TaskUpdate> TaskUpdates => Set<TaskUpdate>();
    public DbSet<QuickLink> QuickLinks => Set<QuickLink>();
    public DbSet<ResourceItem> ResourceItems => Set<ResourceItem>();
    public DbSet<RoomReservation> RoomReservations => Set<RoomReservation>();
    public DbSet<TaskRating> TaskRatings => Set<TaskRating>();
    public DbSet<Sprint> Sprints => Set<Sprint>();
    public DbSet<SprintReview> SprintReviews => Set<SprintReview>();
    public DbSet<GameSession> GameSessions => Set<GameSession>();
    public DbSet<GameVote> GameVotes => Set<GameVote>();
    public DbSet<ScheduleItem> ScheduleItems => Set<ScheduleItem>();
    public DbSet<LoginItem> LoginItems => Set<LoginItem>();
    public DbSet<ProjectSettings> ProjectSettings => Set<ProjectSettings>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Unique: one rating per member per task
        modelBuilder.Entity<TaskRating>()
            .HasIndex(r => new { r.TaskItemId, r.GroupMemberId })
            .IsUnique();

        // Unique: one assignment per member per task
        modelBuilder.Entity<TaskAssignment>()
            .HasIndex(a => new { a.TaskItemId, a.GroupMemberId })
            .IsUnique();

        // Unique: one vote per member per task per session
        modelBuilder.Entity<GameVote>()
            .HasIndex(v => new { v.SessionId, v.TaskItemId, v.GroupMemberId })
            .IsUnique();

        // Store TaskStatus enum as string
        modelBuilder.Entity<TaskItem>()
            .Property(t => t.Status)
            .HasConversion<string>();

        modelBuilder.Entity<TaskItem>()
            .Property(t => t.Priority)
            .HasConversion<string>();

        // Store TaskCategory as string
        modelBuilder.Entity<TaskItem>()
            .Property(t => t.Category)
            .HasConversion<string>();

        modelBuilder.Entity<ResourceItem>()
            .Property(r => r.Type)
            .HasConversion<string>();

        // TimeSpan is not natively supported by SQLite — store as ticks
        modelBuilder.Entity<RoomReservation>()
            .Property(r => r.StartTime)
            .HasConversion(
                v => v.Ticks,
                v => TimeSpan.FromTicks(v));

        modelBuilder.Entity<RoomReservation>()
            .Property(r => r.EndTime)
            .HasConversion(
                v => v.Ticks,
                v => TimeSpan.FromTicks(v));

        modelBuilder.Entity<ScheduleItem>()
            .Property(s => s.StartTime)
            .HasConversion(
                v => v.Ticks,
                v => TimeSpan.FromTicks(v));

        modelBuilder.Entity<ScheduleItem>()
            .Property(s => s.EndTime)
            .HasConversion(
                v => v.Ticks,
                v => TimeSpan.FromTicks(v));
    }
}
