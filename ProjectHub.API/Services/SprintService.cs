using Microsoft.EntityFrameworkCore;
using ProjectHub.API.Data;
using ProjectHub.API.DTOs;
using ProjectHub.API.Models;

namespace ProjectHub.API.Services;

public class SprintService(AppDbContext db)
{
    private static SprintReviewDto ToReviewDto(SprintReview r) => new(
        r.Id,
        r.SprintId,
        r.GroupMemberId,
        r.GroupMember?.Name,
        r.GroupMember?.Color,
        r.GroupMember?.AvatarInitial,
        r.Content,
        r.CreatedAt
    );

    private static SprintDto ToDto(Sprint s) => new(
        s.Id,
        s.Number,
        s.Goal,
        s.DueDate,
        s.PlanningNotes,
        s.RetrospectiveNotes,
        s.IsActive,
        s.Reviews.Select(ToReviewDto).OrderByDescending(r => r.CreatedAt).ToList()
    );

    private IQueryable<Sprint> WithIncludes() =>
        db.Sprints
          .Include(s => s.Reviews)
              .ThenInclude(r => r.GroupMember);

    public async Task<List<SprintDto>> GetAllAsync() =>
        await WithIncludes().OrderBy(s => s.Number)
                            .Select(s => ToDto(s))
                            .ToListAsync();

    public async Task<SprintDto?> GetByIdAsync(int id) =>
        await WithIncludes().Where(s => s.Id == id)
                            .Select(s => ToDto(s))
                            .FirstOrDefaultAsync();

    public async Task<SprintDto> CreateAsync(CreateSprintDto dto)
    {
        var sprint = new Sprint
        {
            Number = dto.Number,
            Goal = dto.Goal,
            DueDate = dto.DueDate,
            PlanningNotes = dto.PlanningNotes,
            RetrospectiveNotes = dto.RetrospectiveNotes,
            IsActive = dto.IsActive,
        };
        db.Sprints.Add(sprint);
        await db.SaveChangesAsync();
        return ToDto(await WithIncludes().FirstAsync(s => s.Id == sprint.Id));
    }

    public async Task<SprintDto?> UpdateAsync(int id, UpdateSprintDto dto)
    {
        var sprint = await db.Sprints.FindAsync(id);
        if (sprint is null) return null;

        sprint.Number = dto.Number;
        sprint.Goal = dto.Goal;
        sprint.DueDate = dto.DueDate;
        sprint.PlanningNotes = dto.PlanningNotes;
        sprint.RetrospectiveNotes = dto.RetrospectiveNotes;
        sprint.IsActive = dto.IsActive;

        await db.SaveChangesAsync();
        return ToDto(await WithIncludes().FirstAsync(s => s.Id == id));
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var sprint = await db.Sprints.FindAsync(id);
        if (sprint is null) return false;
        db.Sprints.Remove(sprint);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<List<SprintReviewDto>> GetReviewsAsync(int sprintId) =>
        await db.SprintReviews
                .Include(r => r.GroupMember)
                .Where(r => r.SprintId == sprintId)
                .OrderByDescending(r => r.CreatedAt)
                .Select(r => ToReviewDto(r))
                .ToListAsync();

    public async Task<SprintReviewDto?> AddReviewAsync(int sprintId, CreateSprintReviewDto dto)
    {
        if (!await db.Sprints.AnyAsync(s => s.Id == sprintId)) return null;

        var review = new SprintReview
        {
            SprintId = sprintId,
            GroupMemberId = dto.MemberId,
            Content = dto.Content,
            CreatedAt = DateTime.UtcNow,
        };
        db.SprintReviews.Add(review);
        await db.SaveChangesAsync();

        var saved = await db.SprintReviews
            .Include(r => r.GroupMember)
            .FirstAsync(r => r.Id == review.Id);
        return ToReviewDto(saved);
    }

    public async Task<bool> DeleteReviewAsync(int reviewId)
    {
        var review = await db.SprintReviews.FindAsync(reviewId);
        if (review is null) return false;
        db.SprintReviews.Remove(review);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<ProjectSettingsDto> GetSettingsAsync()
    {
        var settings = await db.ProjectSettings.FindAsync(1);
        if (settings is null)
        {
            settings = new ProjectSettings { Id = 1, ProductGoal = null };
            db.ProjectSettings.Add(settings);
            await db.SaveChangesAsync();
        }
        return new ProjectSettingsDto(settings.Id, settings.ProductGoal);
    }

    public async Task<ProjectSettingsDto> UpdateSettingsAsync(UpdateProjectSettingsDto dto)
    {
        var settings = await db.ProjectSettings.FindAsync(1);
        if (settings is null)
        {
            settings = new ProjectSettings { Id = 1, ProductGoal = dto.ProductGoal };
            db.ProjectSettings.Add(settings);
        }
        else
        {
            settings.ProductGoal = dto.ProductGoal;
        }
        await db.SaveChangesAsync();
        return new ProjectSettingsDto(settings.Id, settings.ProductGoal);
    }
}
