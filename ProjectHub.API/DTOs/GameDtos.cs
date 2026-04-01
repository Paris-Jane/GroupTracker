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
    int? CurrentAssigneeId  // currently assigned (if any)
);

public record TaskUpdateDto(
    int Id,
    int TaskItemId,
    string TaskName,
    int? GroupMemberId,
    string? MemberName,
    string? MemberColor,
    string ActionType,
    string Message,
    DateTime CreatedAt
);
