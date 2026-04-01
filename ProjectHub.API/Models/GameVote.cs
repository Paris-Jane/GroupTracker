namespace ProjectHub.API.Models;

public class GameVote
{
    public int Id { get; set; }
    public int SessionId { get; set; }
    public int TaskItemId { get; set; }
    public int GroupMemberId { get; set; }
    public int VoteValue { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public GameSession GameSession { get; set; } = null!;
    public TaskItem TaskItem { get; set; } = null!;
    public GroupMember GroupMember { get; set; } = null!;
}
