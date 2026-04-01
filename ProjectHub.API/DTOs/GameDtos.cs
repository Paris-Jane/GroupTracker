using ProjectHub.API.Models;

namespace ProjectHub.API.DTOs;

public record SubmitRatingDto(int MemberId, int RatingValue);

public record TaskRatingDto(
    int Id,
    int TaskItemId,
    int GroupMemberId,
    string MemberName,
    string? MemberColor,
    int RatingValue
);

public record TaskRatingSummaryDto(
    int TaskItemId,
    string TaskName,
    List<TaskRatingDto> Ratings,
    int? HighestScoringMemberId,
    string? HighestScoringMemberName,
    int? CurrentAssigneeId
);

public record TaskUpdateDto(
    int Id,
    int TaskItemId,
    string TaskName,
    int? GroupMemberId,
    string? MemberName,
    string? MemberColor,
    string? MemberAvatarInitial,
    string ActionType,
    string Message,
    DateTime CreatedAt
);

// ── Game Session DTOs ────────────────────────────────────────────────────────

public record CreateGameSessionDto(GameType GameType, int? SprintFilter, int? CreatedByMemberId);

public record GameVoteDto(
    int Id,
    int TaskItemId,
    int GroupMemberId,
    string MemberName,
    string? MemberColor,
    string? MemberAvatarInitial,
    int VoteValue
);

public record GameSessionDto(
    int Id,
    string GameType,
    bool IsActive,
    int CurrentTaskIndex,
    int? SprintFilter,
    List<TaskItemDto> Tasks,
    List<GameVoteDto> Votes,
    int MemberCount
);

public record SubmitGameVoteDto(int MemberId, int TaskItemId, int VoteValue);

public record ApplyEvaluationDto(int TaskItemId, int Evaluation);

// ── Sprint DTOs ──────────────────────────────────────────────────────────────

public record SprintReviewDto(
    int Id,
    int SprintId,
    int? GroupMemberId,
    string? MemberName,
    string? MemberColor,
    string? MemberAvatarInitial,
    string Content,
    DateTime CreatedAt
);

public record SprintDto(
    int Id,
    int Number,
    string? Goal,
    DateTime? DueDate,
    string? PlanningNotes,
    string? RetrospectiveNotes,
    bool IsActive,
    List<SprintReviewDto> Reviews
);

public record CreateSprintDto(
    int Number,
    string? Goal,
    DateTime? DueDate,
    string? PlanningNotes,
    string? RetrospectiveNotes,
    bool IsActive
);

public record UpdateSprintDto(
    int Number,
    string? Goal,
    DateTime? DueDate,
    string? PlanningNotes,
    string? RetrospectiveNotes,
    bool IsActive
);

public record CreateSprintReviewDto(int? MemberId, string Content);

public record ProjectSettingsDto(int Id, string? ProductGoal);

public record UpdateProjectSettingsDto(string? ProductGoal);

// ── Schedule DTOs ────────────────────────────────────────────────────────────

public record ScheduleItemDto(
    int Id,
    string Title,
    string Category,
    string Date,
    string StartTime,
    string EndTime,
    int? GroupMemberId,
    string? MemberName,
    string? MemberColor,
    string? MemberAvatarInitial,
    string? Location,
    string? Notes,
    DateTime CreatedAt
);

public record CreateScheduleItemDto(
    string Title,
    ProjectHub.API.Models.ScheduleCategory Category,
    DateTime Date,
    string StartTime,
    string EndTime,
    int? GroupMemberId,
    string? Location,
    string? Notes
);

public record UpdateScheduleItemDto(
    string Title,
    ProjectHub.API.Models.ScheduleCategory Category,
    DateTime Date,
    string StartTime,
    string EndTime,
    int? GroupMemberId,
    string? Location,
    string? Notes
);
