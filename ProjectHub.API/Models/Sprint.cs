namespace ProjectHub.API.Models;

public class Sprint
{
    public int Id { get; set; }
    public int Number { get; set; }
    public string? Goal { get; set; }
    public DateTime? DueDate { get; set; }
    public string? PlanningNotes { get; set; }
    public string? RetrospectiveNotes { get; set; }
    public bool IsActive { get; set; } = false;

    // Navigation
    public ICollection<SprintReview> Reviews { get; set; } = [];
}
