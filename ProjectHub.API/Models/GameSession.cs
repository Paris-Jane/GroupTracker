namespace ProjectHub.API.Models;

public enum GameType
{
    Poker = 0,
    PickTasks = 1
}

public class GameSession
{
    public int Id { get; set; }
    public GameType GameType { get; set; } = GameType.Poker;
    public int? SprintFilter { get; set; }
    public bool IsActive { get; set; } = true;
    public int CurrentTaskIndex { get; set; } = 0;
    // JSON array of task IDs e.g. "[1,2,3]"
    public string TaskIds { get; set; } = "[]";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int? CreatedByMemberId { get; set; }

    // Navigation
    public ICollection<GameVote> Votes { get; set; } = [];
}
