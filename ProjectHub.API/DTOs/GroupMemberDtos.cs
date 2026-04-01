namespace ProjectHub.API.DTOs;

public record GroupMemberDto(
    int Id,
    string Name,
    string? Email,
    string? AvatarInitial,
    string? Color
);

public record CreateGroupMemberDto(
    string Name,
    string? Email,
    string? AvatarInitial,
    string? Color
);

public record UpdateGroupMemberDto(
    string Name,
    string? Email,
    string? AvatarInitial,
    string? Color
);
