namespace ProjectHub.API.Models;

public class GroupMember
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? AvatarInitial { get; set; }
    public string? Color { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;

    // Navigation
    public ICollection<TaskAssignment> TaskAssignments { get; set; } = [];
    public ICollection<TaskUpdate> TaskUpdates { get; set; } = [];
    public ICollection<TaskRating> TaskRatings { get; set; } = [];
    public ICollection<RoomReservation> RoomReservations { get; set; } = [];
    public ICollection<SprintReview> SprintReviews { get; set; } = [];
    public ICollection<ScheduleItem> ScheduleItems { get; set; } = [];
}
