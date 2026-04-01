using ProjectHub.API.Models;

namespace ProjectHub.API.DTOs;

// ── Quick Links ─────────────────────────────────────────────────────────────

public record QuickLinkDto(
    int Id,
    string Title,
    string Url,
    string? Category,
    string? Notes,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record CreateQuickLinkDto(
    string Title,
    string Url,
    string? Category,
    string? Notes
);

public record UpdateQuickLinkDto(
    string Title,
    string Url,
    string? Category,
    string? Notes
);

// ── Resource Items ───────────────────────────────────────────────────────────

public record ResourceItemDto(
    int Id,
    string Title,
    string? Description,
    string Type,
    string? Category,
    string? ClassCategory,
    string? Url,
    string? Notes,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record CreateResourceItemDto(
    string Title,
    string? Description,
    ResourceType Type,
    string? Category,
    string? ClassCategory,
    string? Url,
    string? Notes
);

public record UpdateResourceItemDto(
    string Title,
    string? Description,
    ResourceType Type,
    string? Category,
    string? ClassCategory,
    string? Url,
    string? Notes
);

// ── Room Reservations ────────────────────────────────────────────────────────

public record RoomReservationDto(
    int Id,
    string RoomName,
    DateTime Date,
    string StartTime,
    string EndTime,
    int? GroupMemberId,
    string ReservedBy,
    string? Notes,
    DateTime CreatedAt
);

public record CreateRoomReservationDto(
    string RoomName,
    DateTime Date,
    string StartTime,
    string EndTime,
    int? GroupMemberId,
    string ReservedBy,
    string? Notes
);

public record UpdateRoomReservationDto(
    string RoomName,
    DateTime Date,
    string StartTime,
    string EndTime,
    int? GroupMemberId,
    string ReservedBy,
    string? Notes
);

// ── Login Items ──────────────────────────────────────────────────────────────

public record LoginItemDto(
    int Id,
    string Title,
    string? SiteUrl,
    string? LoginUsername,
    string? LoginPassword,
    string? Notes,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record CreateLoginItemDto(
    string Title,
    string? SiteUrl,
    string? LoginUsername,
    string? LoginPassword,
    string? Notes
);

public record UpdateLoginItemDto(
    string Title,
    string? SiteUrl,
    string? LoginUsername,
    string? LoginPassword,
    string? Notes
);
