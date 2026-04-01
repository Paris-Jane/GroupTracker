namespace ProjectHub.API.Models;

public class TaskRating
{
    public int Id { get; set; }
    public int TaskItemId { get; set; }
    public int GroupMemberId { get; set; }
    // 1–10 self-assessed ability score
    public int RatingValue { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public TaskItem TaskItem { get; set; } = null!;
    public GroupMember GroupMember { get; set; } = null!;
}
