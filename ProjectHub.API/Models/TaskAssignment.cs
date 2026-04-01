namespace ProjectHub.API.Models;

public class TaskAssignment
{
    public int Id { get; set; }
    public int TaskItemId { get; set; }
    public int GroupMemberId { get; set; }
    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public TaskItem TaskItem { get; set; } = null!;
    public GroupMember GroupMember { get; set; } = null!;
}
