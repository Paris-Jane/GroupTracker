using Microsoft.EntityFrameworkCore;
using ProjectHub.API.Data;
using ProjectHub.API.DTOs;
using ProjectHub.API.Models;
using TaskStatus = ProjectHub.API.Models.TaskStatus;

namespace ProjectHub.API.Services;

public class TaskService(AppDbContext db)
{
    // ── Helpers ────────────────────────────────────────────────────────────

    private static TaskItemDto ToDto(TaskItem t) => new(
        t.Id,
        t.Name,
        t.Description,
        t.EstimatedTime,
        t.Deadline,
        t.Priority.ToString(),
        t.IsRequired,
        t.Status.ToString(),
        t.Tags,
        t.CreatedAt,
        t.UpdatedAt,
        t.Subtasks.Select(s => new SubtaskDto(s.Id, s.TaskItemId, s.Name, s.IsCompleted, s.CreatedAt)).ToList(),
        t.TaskAssignments.Select(a => new TaskAssignmentDto(
            a.Id,
            a.GroupMemberId,
            a.GroupMember?.Name ?? "Unknown",
            a.GroupMember?.Color,
            a.GroupMember?.AvatarInitial)).ToList()
    );

    private IQueryable<TaskItem> WithIncludes() =>
        db.TaskItems
          .Include(t => t.Subtasks)
          .Include(t => t.TaskAssignments)
              .ThenInclude(a => a.GroupMember);

    private async Task LogUpdate(int taskId, int? memberId, string action, string message)
    {
        db.TaskUpdates.Add(new TaskUpdate
        {
            TaskItemId = taskId,
            GroupMemberId = memberId,
            ActionType = action,
            Message = message,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
    }

    // ── CRUD ───────────────────────────────────────────────────────────────

    public async Task<List<TaskItemDto>> GetAllAsync() =>
        await WithIncludes().OrderByDescending(t => t.CreatedAt)
                            .Select(t => ToDto(t))
                            .ToListAsync();

    public async Task<TaskItemDto?> GetByIdAsync(int id) =>
        await WithIncludes().Where(t => t.Id == id)
                            .Select(t => ToDto(t))
                            .FirstOrDefaultAsync();

    public async Task<List<TaskItemDto>> GetByMemberAsync(int memberId) =>
        await WithIncludes()
              .Where(t => t.TaskAssignments.Any(a => a.GroupMemberId == memberId))
              .OrderByDescending(t => t.Deadline)
              .Select(t => ToDto(t))
              .ToListAsync();

    public async Task<TaskItemDto> CreateAsync(CreateTaskItemDto dto, int? actorId)
    {
        var task = new TaskItem
        {
            Name = dto.Name,
            Description = dto.Description,
            EstimatedTime = dto.EstimatedTime,
            Deadline = dto.Deadline,
            Priority = dto.Priority,
            IsRequired = dto.IsRequired,
            Status = dto.Status,
            Tags = dto.Tags,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        if (dto.SubtaskNames != null)
            task.Subtasks = dto.SubtaskNames.Select(n => new Subtask { Name = n }).ToList();

        db.TaskItems.Add(task);
        await db.SaveChangesAsync();

        if (dto.AssigneeIds != null && dto.AssigneeIds.Count > 0)
        {
            foreach (var mid in dto.AssigneeIds.Distinct())
            {
                db.TaskAssignments.Add(new TaskAssignment { TaskItemId = task.Id, GroupMemberId = mid });
            }
            await db.SaveChangesAsync();
        }

        await LogUpdate(task.Id, actorId, "Created", $"Task \"{task.Name}\" was created");
        return ToDto(await WithIncludes().FirstAsync(t => t.Id == task.Id));
    }

    public async Task<TaskItemDto?> UpdateAsync(int id, UpdateTaskItemDto dto, int? actorId)
    {
        var task = await db.TaskItems.FindAsync(id);
        if (task is null) return null;

        task.Name = dto.Name;
        task.Description = dto.Description;
        task.EstimatedTime = dto.EstimatedTime;
        task.Deadline = dto.Deadline;
        task.Priority = dto.Priority;
        task.IsRequired = dto.IsRequired;
        task.Status = dto.Status;
        task.Tags = dto.Tags;
        task.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        await LogUpdate(id, actorId, "Updated", $"Task \"{task.Name}\" was updated");
        return ToDto(await WithIncludes().FirstAsync(t => t.Id == id));
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var task = await db.TaskItems.FindAsync(id);
        if (task is null) return false;
        db.TaskItems.Remove(task);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<TaskItemDto?> UpdateStatusAsync(int id, TaskStatus status, int? actorId)
    {
        var task = await db.TaskItems.FindAsync(id);
        if (task is null) return null;

        task.Status = status;
        task.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        await LogUpdate(id, actorId, "StatusChanged", $"Status changed to {status}");
        return ToDto(await WithIncludes().FirstAsync(t => t.Id == id));
    }

    // ── Assignments ────────────────────────────────────────────────────────

    public async Task<TaskItemDto?> AssignAsync(int taskId, List<int> memberIds, int? actorId)
    {
        var task = await db.TaskItems.Include(t => t.TaskAssignments).FirstOrDefaultAsync(t => t.Id == taskId);
        if (task is null) return null;

        // Replace all assignments
        db.TaskAssignments.RemoveRange(task.TaskAssignments);

        foreach (var mid in memberIds.Distinct())
        {
            db.TaskAssignments.Add(new TaskAssignment { TaskItemId = taskId, GroupMemberId = mid });
        }
        task.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        var names = await db.GroupMembers
            .Where(m => memberIds.Contains(m.Id))
            .Select(m => m.Name)
            .ToListAsync();
        await LogUpdate(taskId, actorId, "Assigned", $"Assigned to {string.Join(", ", names)}");
        return ToDto(await WithIncludes().FirstAsync(t => t.Id == taskId));
    }

    // ── Subtasks ───────────────────────────────────────────────────────────

    public async Task<SubtaskDto?> CreateSubtaskAsync(int taskId, CreateSubtaskDto dto)
    {
        if (!await db.TaskItems.AnyAsync(t => t.Id == taskId)) return null;
        var sub = new Subtask { TaskItemId = taskId, Name = dto.Name };
        db.Subtasks.Add(sub);
        await db.SaveChangesAsync();
        return new SubtaskDto(sub.Id, sub.TaskItemId, sub.Name, sub.IsCompleted, sub.CreatedAt);
    }

    public async Task<SubtaskDto?> UpdateSubtaskAsync(int subtaskId, UpdateSubtaskDto dto)
    {
        var sub = await db.Subtasks.FindAsync(subtaskId);
        if (sub is null) return null;
        sub.Name = dto.Name;
        sub.IsCompleted = dto.IsCompleted;
        await db.SaveChangesAsync();
        return new SubtaskDto(sub.Id, sub.TaskItemId, sub.Name, sub.IsCompleted, sub.CreatedAt);
    }

    public async Task<bool> DeleteSubtaskAsync(int subtaskId)
    {
        var sub = await db.Subtasks.FindAsync(subtaskId);
        if (sub is null) return false;
        db.Subtasks.Remove(sub);
        await db.SaveChangesAsync();
        return true;
    }

    // ── Bulk Import ────────────────────────────────────────────────────────

    public async Task<List<TaskItemDto>> BulkImportAsync(List<BulkImportTaskDto> dtos, int? actorId)
    {
        var allMembers = await db.GroupMembers.ToListAsync();
        var created = new List<TaskItemDto>();

        foreach (var dto in dtos)
        {
            var assigneeIds = dto.AssigneeNames?
                .Select(name => allMembers.FirstOrDefault(m =>
                    m.Name.Equals(name, StringComparison.OrdinalIgnoreCase))?.Id)
                .Where(id => id.HasValue)
                .Select(id => id!.Value)
                .ToList() ?? [];

            var createDto = new CreateTaskItemDto(
                dto.Name, dto.Description, dto.EstimatedTime,
                dto.Deadline, dto.Priority, dto.IsRequired,
                dto.Status, dto.Tags, assigneeIds, dto.SubtaskNames);

            created.Add(await CreateAsync(createDto, actorId));
        }
        return created;
    }

    // ── Recent Updates ─────────────────────────────────────────────────────

    public async Task<List<TaskUpdateDto>> GetRecentUpdatesAsync(int count = 15) =>
        await db.TaskUpdates
                .Include(u => u.TaskItem)
                .Include(u => u.GroupMember)
                .OrderByDescending(u => u.CreatedAt)
                .Take(count)
                .Select(u => new TaskUpdateDto(
                    u.Id,
                    u.TaskItemId,
                    u.TaskItem.Name,
                    u.GroupMemberId,
                    u.GroupMember != null ? u.GroupMember.Name : null,
                    u.GroupMember != null ? u.GroupMember.Color : null,
                    u.ActionType,
                    u.Message,
                    u.CreatedAt))
                .ToListAsync();
}
