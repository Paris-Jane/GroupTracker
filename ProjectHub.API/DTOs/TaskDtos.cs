using ProjectHub.API.Models;
using TaskStatus = ProjectHub.API.Models.TaskStatus;

namespace ProjectHub.API.DTOs;

public record SubtaskDto(
    int Id,
    int TaskItemId,
    string Name,
    bool IsCompleted,
    DateTime CreatedAt
);

public record TaskAssignmentDto(
    int Id,
    int GroupMemberId,
    string MemberName,
    string? MemberColor,
    string? MemberAvatarInitial
);

public record TaskItemDto(
    int Id,
    string Name,
    string? Description,
    string? EstimatedTime,
    DateTime? Deadline,
    string Priority,
    bool IsRequired,
    string Status,
    string? Tags,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    List<SubtaskDto> Subtasks,
    List<TaskAssignmentDto> Assignments
);

public record CreateTaskItemDto(
    string Name,
    string? Description,
    string? EstimatedTime,
    DateTime? Deadline,
    TaskPriority Priority,
    bool IsRequired,
    TaskStatus Status,
    string? Tags,
    List<int>? AssigneeIds,
    List<string>? SubtaskNames
);

public record UpdateTaskItemDto(
    string Name,
    string? Description,
    string? EstimatedTime,
    DateTime? Deadline,
    TaskPriority Priority,
    bool IsRequired,
    TaskStatus Status,
    string? Tags
);

public record UpdateTaskStatusDto(TaskStatus Status);

public record AssignTaskDto(List<int> MemberIds);

public record BulkImportTaskDto(
    string Name,
    string? Description,
    string? EstimatedTime,
    DateTime? Deadline,
    TaskPriority Priority,
    bool IsRequired,
    TaskStatus Status,
    string? Tags,
    List<string>? SubtaskNames,
    List<string>? AssigneeNames   // matched by name against existing members
);

public record CreateSubtaskDto(string Name);

public record UpdateSubtaskDto(string Name, bool IsCompleted);
