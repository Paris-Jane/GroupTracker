namespace ProjectHub.API.Models;

public class RoomReservation
{
    public int Id { get; set; }
    public string RoomName { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public TimeSpan StartTime { get; set; }
    public TimeSpan EndTime { get; set; }
    // FK to group member who reserved; name stored as fallback
    public int? GroupMemberId { get; set; }
    public string ReservedBy { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public GroupMember? GroupMember { get; set; }
}
