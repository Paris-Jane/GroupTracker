using Microsoft.EntityFrameworkCore;
using ProjectHub.API.Models;
// Alias to avoid collision with EF's own DataAnnotations
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

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Unique constraint: one rating per member per task
        modelBuilder.Entity<TaskRating>()
            .HasIndex(r => new { r.TaskItemId, r.GroupMemberId })
            .IsUnique();

        // Unique constraint: one assignment per member per task
        modelBuilder.Entity<TaskAssignment>()
            .HasIndex(a => new { a.TaskItemId, a.GroupMemberId })
            .IsUnique();

        // Store enum as string for readability in the SQLite file
        modelBuilder.Entity<TaskItem>()
            .Property(t => t.Status)
            .HasConversion<string>();

        modelBuilder.Entity<TaskItem>()
            .Property(t => t.Priority)
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
    }
}
