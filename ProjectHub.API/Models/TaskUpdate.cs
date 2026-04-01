namespace ProjectHub.API.Models;

public class TaskUpdate
{
    public int Id { get; set; }
    public int TaskItemId { get; set; }
    // Null means the action was performed by the system or is unknown
    public int? GroupMemberId { get; set; }
    // e.g. "Created", "StatusChanged", "Assigned", "Completed", "DeadlineChanged", "NotesUpdated"
    public string ActionType { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public TaskItem TaskItem { get; set; } = null!;
    public GroupMember? GroupMember { get; set; }
}
