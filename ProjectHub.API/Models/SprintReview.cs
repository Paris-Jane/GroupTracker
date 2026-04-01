namespace ProjectHub.API.Models;

public class SprintReview
{
    public int Id { get; set; }
    public int SprintId { get; set; }
    public int? GroupMemberId { get; set; }
    public string Content { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public Sprint Sprint { get; set; } = null!;
    public GroupMember? GroupMember { get; set; }
}
