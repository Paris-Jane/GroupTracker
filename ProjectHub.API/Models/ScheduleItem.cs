namespace ProjectHub.API.Models;

public enum ScheduleCategory
{
    Room = 0,
    Meeting = 1,
    Unavailable = 2,
    Other = 3
}

public class ScheduleItem
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public ScheduleCategory ScheduleCategory { get; set; } = ScheduleCategory.Other;
    public DateTime Date { get; set; }
    public TimeSpan StartTime { get; set; }
    public TimeSpan EndTime { get; set; }
    public int? GroupMemberId { get; set; }
    public string? Location { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public GroupMember? GroupMember { get; set; }
}
