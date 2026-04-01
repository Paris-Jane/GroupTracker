namespace ProjectHub.API.Models;

public enum TaskStatus
{
    NotStarted,
    WorkingOnIt,
    Completed
}

public enum TaskPriority
{
    Low,
    Medium,
    High
}

public class TaskItem
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    // e.g. "2 hours", "30 minutes"
    public string? EstimatedTime { get; set; }
    public DateTime? Deadline { get; set; }
    public TaskPriority Priority { get; set; } = TaskPriority.Medium;
    public bool IsRequired { get; set; } = true;
    public TaskStatus Status { get; set; } = TaskStatus.NotStarted;
    // Optional comma-separated tags / category
    public string? Tags { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public ICollection<Subtask> Subtasks { get; set; } = [];
    public ICollection<TaskAssignment> TaskAssignments { get; set; } = [];
    public ICollection<TaskUpdate> TaskUpdates { get; set; } = [];
    public ICollection<TaskRating> TaskRatings { get; set; } = [];
}
