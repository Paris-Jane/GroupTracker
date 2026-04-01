namespace ProjectHub.API.Models;

public class ProjectSettings
{
    // Always Id = 1 (singleton row)
    public int Id { get; set; } = 1;
    public string? ProductGoal { get; set; }
}
