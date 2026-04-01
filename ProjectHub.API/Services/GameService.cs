using Microsoft.EntityFrameworkCore;
using ProjectHub.API.Data;
using ProjectHub.API.DTOs;
using ProjectHub.API.Models;

namespace ProjectHub.API.Services;

public class GameService(AppDbContext db)
{
    public async Task<TaskRatingDto> SubmitRatingAsync(int taskId, SubmitRatingDto dto)
    {
        if (dto.RatingValue < 1 || dto.RatingValue > 10)
            throw new ArgumentOutOfRangeException(nameof(dto.RatingValue), "Rating must be 1–10.");

        var existing = await db.TaskRatings
            .FirstOrDefaultAsync(r => r.TaskItemId == taskId && r.GroupMemberId == dto.MemberId);

        GroupMember? member = await db.GroupMembers.FindAsync(dto.MemberId)
            ?? throw new KeyNotFoundException($"GroupMember {dto.MemberId} not found.");

        if (existing is null)
        {
            existing = new TaskRating
            {
                TaskItemId = taskId,
                GroupMemberId = dto.MemberId,
                RatingValue = dto.RatingValue,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            db.TaskRatings.Add(existing);
        }
        else
        {
            existing.RatingValue = dto.RatingValue;
            existing.UpdatedAt = DateTime.UtcNow;
        }
        await db.SaveChangesAsync();

        return new TaskRatingDto(existing.Id, taskId, dto.MemberId, member.Name, member.Color, dto.RatingValue);
    }

    public async Task<List<TaskRatingSummaryDto>> GetRatingSummariesAsync()
    {
        var tasks = await db.TaskItems
            .Include(t => t.TaskRatings).ThenInclude(r => r.GroupMember)
            .Include(t => t.TaskAssignments)
            .ToListAsync();

        return tasks.Select(t =>
        {
            var ratings = t.TaskRatings.Select(r => new TaskRatingDto(
                r.Id, r.TaskItemId, r.GroupMemberId,
                r.GroupMember?.Name ?? "Unknown",
                r.GroupMember?.Color,
                r.RatingValue)).ToList();

            var top = t.TaskRatings.OrderByDescending(r => r.RatingValue).FirstOrDefault();

            return new TaskRatingSummaryDto(
                t.Id,
                t.Name,
                ratings,
                top?.GroupMemberId,
                top?.GroupMember?.Name,
                t.TaskAssignments.FirstOrDefault()?.GroupMemberId
            );
        }).ToList();
    }

    public async Task<TaskRatingSummaryDto?> GetRatingSummaryForTaskAsync(int taskId)
    {
        var task = await db.TaskItems
            .Include(t => t.TaskRatings).ThenInclude(r => r.GroupMember)
            .Include(t => t.TaskAssignments)
            .FirstOrDefaultAsync(t => t.Id == taskId);

        if (task is null) return null;

        var ratings = task.TaskRatings.Select(r => new TaskRatingDto(
            r.Id, r.TaskItemId, r.GroupMemberId,
            r.GroupMember?.Name ?? "Unknown",
            r.GroupMember?.Color,
            r.RatingValue)).ToList();

        var top = task.TaskRatings.OrderByDescending(r => r.RatingValue).FirstOrDefault();

        return new TaskRatingSummaryDto(
            task.Id,
            task.Name,
            ratings,
            top?.GroupMemberId,
            top?.GroupMember?.Name,
            task.TaskAssignments.FirstOrDefault()?.GroupMemberId
        );
    }
}
