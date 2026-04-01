namespace ProjectHub.API.DTOs;

public record GroupMemberDto(
    int Id,
    string Name,
    string? Email,
    string? AvatarInitial,
    string? Color,
    string Username
);

public record CreateGroupMemberDto(
    string Name,
    string? Email,
    string? AvatarInitial,
    string? Color,
    string Username,
    string Password
);

public record UpdateGroupMemberDto(
    string Name,
    string? Email,
    string? AvatarInitial,
    string? Color,
    string Username,
    string Password
);

public record LoginRequestDto(string Username, string Password);
