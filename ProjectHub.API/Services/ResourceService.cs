using Microsoft.EntityFrameworkCore;
using ProjectHub.API.Data;
using ProjectHub.API.DTOs;
using ProjectHub.API.Models;

namespace ProjectHub.API.Services;

public class ResourceService(AppDbContext db)
{
    // ── Quick Links ────────────────────────────────────────────────────────

    public async Task<List<QuickLinkDto>> GetAllLinksAsync() =>
        await db.QuickLinks.OrderBy(l => l.Category).ThenBy(l => l.Title)
                .Select(l => new QuickLinkDto(l.Id, l.Title, l.Url, l.Category, l.Notes, l.CreatedAt, l.UpdatedAt))
                .ToListAsync();

    public async Task<QuickLinkDto> CreateLinkAsync(CreateQuickLinkDto dto)
    {
        var link = new QuickLink
        {
            Title = dto.Title,
            Url = dto.Url,
            Category = dto.Category,
            Notes = dto.Notes,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.QuickLinks.Add(link);
        await db.SaveChangesAsync();
        return new QuickLinkDto(link.Id, link.Title, link.Url, link.Category, link.Notes, link.CreatedAt, link.UpdatedAt);
    }

    public async Task<QuickLinkDto?> UpdateLinkAsync(int id, UpdateQuickLinkDto dto)
    {
        var link = await db.QuickLinks.FindAsync(id);
        if (link is null) return null;
        link.Title = dto.Title;
        link.Url = dto.Url;
        link.Category = dto.Category;
        link.Notes = dto.Notes;
        link.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return new QuickLinkDto(link.Id, link.Title, link.Url, link.Category, link.Notes, link.CreatedAt, link.UpdatedAt);
    }

    public async Task<bool> DeleteLinkAsync(int id)
    {
        var link = await db.QuickLinks.FindAsync(id);
        if (link is null) return false;
        db.QuickLinks.Remove(link);
        await db.SaveChangesAsync();
        return true;
    }

    // ── Resource Items ─────────────────────────────────────────────────────

    public async Task<List<ResourceItemDto>> GetAllResourcesAsync() =>
        await db.ResourceItems.OrderBy(r => r.Type).ThenBy(r => r.Title)
                .Select(r => new ResourceItemDto(r.Id, r.Title, r.Description, r.Type.ToString(), r.Category, r.Url, r.Notes, r.CreatedAt, r.UpdatedAt))
                .ToListAsync();

    public async Task<ResourceItemDto> CreateResourceAsync(CreateResourceItemDto dto)
    {
        var item = new ResourceItem
        {
            Title = dto.Title,
            Description = dto.Description,
            Type = dto.Type,
            Category = dto.Category,
            Url = dto.Url,
            Notes = dto.Notes,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.ResourceItems.Add(item);
        await db.SaveChangesAsync();
        return new ResourceItemDto(item.Id, item.Title, item.Description, item.Type.ToString(), item.Category, item.Url, item.Notes, item.CreatedAt, item.UpdatedAt);
    }

    public async Task<ResourceItemDto?> UpdateResourceAsync(int id, UpdateResourceItemDto dto)
    {
        var item = await db.ResourceItems.FindAsync(id);
        if (item is null) return null;
        item.Title = dto.Title;
        item.Description = dto.Description;
        item.Type = dto.Type;
        item.Category = dto.Category;
        item.Url = dto.Url;
        item.Notes = dto.Notes;
        item.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return new ResourceItemDto(item.Id, item.Title, item.Description, item.Type.ToString(), item.Category, item.Url, item.Notes, item.CreatedAt, item.UpdatedAt);
    }

    public async Task<bool> DeleteResourceAsync(int id)
    {
        var item = await db.ResourceItems.FindAsync(id);
        if (item is null) return false;
        db.ResourceItems.Remove(item);
        await db.SaveChangesAsync();
        return true;
    }

    // ── Room Reservations ──────────────────────────────────────────────────

    private static RoomReservationDto ToReservationDto(RoomReservation r) => new(
        r.Id,
        r.RoomName,
        r.Date,
        r.StartTime.ToString(@"hh\:mm"),
        r.EndTime.ToString(@"hh\:mm"),
        r.GroupMemberId,
        r.ReservedBy,
        r.Notes,
        r.CreatedAt
    );

    public async Task<List<RoomReservationDto>> GetReservationsAsync(DateTime? weekStart = null) =>
        await db.RoomReservations
                .OrderBy(r => r.Date).ThenBy(r => r.StartTime)
                .Select(r => ToReservationDto(r))
                .ToListAsync();

    public async Task<RoomReservationDto> CreateReservationAsync(CreateRoomReservationDto dto)
    {
        if (!TimeSpan.TryParse(dto.StartTime, out var start))
            throw new ArgumentException("Invalid StartTime format. Use HH:mm.");
        if (!TimeSpan.TryParse(dto.EndTime, out var end))
            throw new ArgumentException("Invalid EndTime format. Use HH:mm.");

        var res = new RoomReservation
        {
            RoomName = dto.RoomName,
            Date = dto.Date.Date,
            StartTime = start,
            EndTime = end,
            GroupMemberId = dto.GroupMemberId,
            ReservedBy = dto.ReservedBy,
            Notes = dto.Notes,
            CreatedAt = DateTime.UtcNow
        };
        db.RoomReservations.Add(res);
        await db.SaveChangesAsync();
        return ToReservationDto(res);
    }

    public async Task<RoomReservationDto?> UpdateReservationAsync(int id, UpdateRoomReservationDto dto)
    {
        var res = await db.RoomReservations.FindAsync(id);
        if (res is null) return null;

        if (!TimeSpan.TryParse(dto.StartTime, out var start))
            throw new ArgumentException("Invalid StartTime format. Use HH:mm.");
        if (!TimeSpan.TryParse(dto.EndTime, out var end))
            throw new ArgumentException("Invalid EndTime format. Use HH:mm.");

        res.RoomName = dto.RoomName;
        res.Date = dto.Date.Date;
        res.StartTime = start;
        res.EndTime = end;
        res.GroupMemberId = dto.GroupMemberId;
        res.ReservedBy = dto.ReservedBy;
        res.Notes = dto.Notes;
        await db.SaveChangesAsync();
        return ToReservationDto(res);
    }

    public async Task<bool> DeleteReservationAsync(int id)
    {
        var res = await db.RoomReservations.FindAsync(id);
        if (res is null) return false;
        db.RoomReservations.Remove(res);
        await db.SaveChangesAsync();
        return true;
    }
}
