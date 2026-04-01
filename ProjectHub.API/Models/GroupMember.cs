namespace ProjectHub.API.Models;

public class GroupMember
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Email { get; set; }
    // Single letter or short label for avatar display
    public string? AvatarInitial { get; set; }
    // Hex color string e.g. "#4A90D9"
    public string? Color { get; set; }

    // Navigation
    public ICollection<TaskAssignment> TaskAssignments { get; set; } = [];
    public ICollection<TaskUpdate> TaskUpdates { get; set; } = [];
    public ICollection<TaskRating> TaskRatings { get; set; } = [];
    public ICollection<RoomReservation> RoomReservations { get; set; } = [];
}
