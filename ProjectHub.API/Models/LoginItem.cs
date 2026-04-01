namespace ProjectHub.API.Models;

public class LoginItem
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? SiteUrl { get; set; }
    public string? LoginUsername { get; set; }
    public string? LoginPassword { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
