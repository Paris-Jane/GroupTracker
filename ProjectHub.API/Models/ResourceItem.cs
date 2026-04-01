namespace ProjectHub.API.Models;

public enum ResourceType
{
    TeacherProvided,
    Other
}

public class ResourceItem
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public ResourceType Type { get; set; } = ResourceType.Other;
    public string? Category { get; set; }
    public string? Url { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
