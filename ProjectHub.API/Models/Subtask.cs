namespace ProjectHub.API.Models;

public class Subtask
{
    public int Id { get; set; }
    public int TaskItemId { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsCompleted { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public TaskItem TaskItem { get; set; } = null!;
}
