namespace ProjectHub.API.Models;

public enum ResourceType
{
    ProjectResource = 0,
    ClassLink = 1,
    Other = 2,
    OtherNote = 3
}

public class ResourceItem
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public ResourceType Type { get; set; } = ResourceType.Other;
    public string? Category { get; set; }
    public string? ClassCategory { get; set; }
    public string? Url { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
