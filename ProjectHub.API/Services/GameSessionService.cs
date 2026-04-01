using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ProjectHub.API.Data;
using ProjectHub.API.DTOs;
using ProjectHub.API.Models;

namespace ProjectHub.API.Services;

public class GameSessionService(AppDbContext db)
{
    private static GameVoteDto ToVoteDto(GameVote v) => new(
        v.Id,
        v.TaskItemId,
        v.GroupMemberId,
        v.GroupMember?.Name ?? "Unknown",
        v.GroupMember?.Color,
        v.GroupMember?.AvatarInitial,
        v.VoteValue
    );

    private async Task<GameSessionDto> BuildSessionDtoAsync(GameSession session)
    {
        var taskIds = JsonSerializer.Deserialize<List<int>>(session.TaskIds) ?? [];

        var tasks = await db.TaskItems
            .Include(t => t.Subtasks)
            .Include(t => t.TaskAssignments).ThenInclude(a => a.GroupMember)
            .Where(t => taskIds.Contains(t.Id))
            .ToListAsync();

        // Preserve task order as specified by taskIds
        var orderedTasks = taskIds
            .Select(id => tasks.FirstOrDefault(t => t.Id == id))
            .Where(t => t != null)
            .Select(t => TaskService.ToDto(t!))
            .ToList();

        var votes = await db.GameVotes
            .Include(v => v.GroupMember)
            .Where(v => v.SessionId == session.Id)
            .Select(v => ToVoteDto(v))
            .ToListAsync();

        var memberCount = await db.GroupMembers.CountAsync();

        return new GameSessionDto(
            session.Id,
            session.GameType.ToString(),
            session.IsActive,
            session.CurrentTaskIndex,
            session.SprintFilter,
            orderedTasks,
            votes,
            memberCount
        );
    }

    public async Task<GameSessionDto> CreateSessionAsync(CreateGameSessionDto dto)
    {
        IQueryable<TaskItem> query = db.TaskItems.Where(t => t.Status != TaskStatus.Completed);

        if (dto.SprintFilter.HasValue)
            query = query.Where(t => t.SprintNumber == dto.SprintFilter.Value);

        var taskIds = await query.Select(t => t.Id).ToListAsync();
        var taskIdsJson = JsonSerializer.Serialize(taskIds);

        var session = new GameSession
        {
            GameType = dto.GameType,
            SprintFilter = dto.SprintFilter,
            IsActive = true,
            CurrentTaskIndex = 0,
            TaskIds = taskIdsJson,
            CreatedAt = DateTime.UtcNow,
            CreatedByMemberId = dto.CreatedByMemberId,
        };

        db.GameSessions.Add(session);
        await db.SaveChangesAsync();

        return await BuildSessionDtoAsync(session);
    }

    public async Task<GameSessionDto?> GetSessionAsync(int id)
    {
        var session = await db.GameSessions.FindAsync(id);
        if (session is null) return null;
        return await BuildSessionDtoAsync(session);
    }

    public async Task<GameVoteDto?> SubmitVoteAsync(int sessionId, SubmitGameVoteDto dto)
    {
        var session = await db.GameSessions.FindAsync(sessionId);
        if (session is null || !session.IsActive) return null;

        var existing = await db.GameVotes.FirstOrDefaultAsync(v =>
            v.SessionId == sessionId &&
            v.TaskItemId == dto.TaskItemId &&
            v.GroupMemberId == dto.MemberId);

        if (existing is null)
        {
            existing = new GameVote
            {
                SessionId = sessionId,
                TaskItemId = dto.TaskItemId,
                GroupMemberId = dto.MemberId,
                VoteValue = dto.VoteValue,
                CreatedAt = DateTime.UtcNow,
            };
            db.GameVotes.Add(existing);
        }
        else
        {
            existing.VoteValue = dto.VoteValue;
        }

        await db.SaveChangesAsync();

        var saved = await db.GameVotes
            .Include(v => v.GroupMember)
            .FirstAsync(v => v.Id == existing.Id);

        return ToVoteDto(saved);
    }

    public async Task<List<GameVoteDto>> GetVotesForTaskAsync(int sessionId, int taskItemId) =>
        await db.GameVotes
                .Include(v => v.GroupMember)
                .Where(v => v.SessionId == sessionId && v.TaskItemId == taskItemId)
                .Select(v => ToVoteDto(v))
                .ToListAsync();

    public async Task<bool> ApplyEvaluationAsync(int sessionId, ApplyEvaluationDto dto)
    {
        var task = await db.TaskItems.FindAsync(dto.TaskItemId);
        if (task is null) return false;

        task.Evaluation = dto.Evaluation;
        task.UpdatedAt = DateTime.UtcNow;

        // Advance task index
        var session = await db.GameSessions.FindAsync(sessionId);
        if (session is not null)
        {
            var taskIds = JsonSerializer.Deserialize<List<int>>(session.TaskIds) ?? [];
            var idx = taskIds.IndexOf(dto.TaskItemId);
            if (idx >= 0 && session.CurrentTaskIndex <= idx)
                session.CurrentTaskIndex = idx + 1;
        }

        await db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> EndSessionAsync(int id)
    {
        var session = await db.GameSessions.FindAsync(id);
        if (session is null) return false;
        session.IsActive = false;
        await db.SaveChangesAsync();
        return true;
    }
}
