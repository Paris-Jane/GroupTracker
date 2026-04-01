namespace ProjectHub.API.Models;

public enum TaskStatus
{
    NotStarted,
    InProgress,
    Completed
}

public enum TaskPriority
{
    Low,
    Medium,
    High
}

public enum TaskCategory
{
    ProductBacklog = 0,
    SprintGoal = 1,
    SprintBacklog = 2,
    Other = 3
}

public class TaskItem
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? EstimatedTime { get; set; }
    public DateTime? Deadline { get; set; }
    public TaskPriority Priority { get; set; } = TaskPriority.Medium;
    public bool IsRequired { get; set; } = true;
    public TaskStatus Status { get; set; } = TaskStatus.NotStarted;
    public string? Tags { get; set; }
    public int? SprintNumber { get; set; }
    public TaskCategory Category { get; set; } = TaskCategory.ProductBacklog;
    public int? Evaluation { get; set; }
    public string? DefinitionOfDone { get; set; }
    public bool AcceptedByPO { get; set; } = false;
    public bool IsBlocked { get; set; } = false;
    public string? BlockedReason { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public ICollection<Subtask> Subtasks { get; set; } = [];
    public ICollection<TaskAssignment> TaskAssignments { get; set; } = [];
    public ICollection<TaskUpdate> TaskUpdates { get; set; } = [];
    public ICollection<TaskRating> TaskRatings { get; set; } = [];
    public ICollection<GameVote> GameVotes { get; set; } = [];
}
