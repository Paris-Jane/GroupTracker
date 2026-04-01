using Microsoft.EntityFrameworkCore;
using ProjectHub.API.Data;
using ProjectHub.API.DTOs;
using ProjectHub.API.Models;

namespace ProjectHub.API.Services;

public class ScheduleService(AppDbContext db)
{
    private static readonly DateTime WeekStart = new(2026, 4, 6);
    private static readonly DateTime WeekEnd = new(2026, 4, 10, 23, 59, 59);

    private static ScheduleItemDto ToDto(ScheduleItem s) => new(
        s.Id,
        s.Title,
        s.ScheduleCategory.ToString(),
        s.Date.ToString("yyyy-MM-dd"),
        s.StartTime.ToString(@"HH\:mm"),
        s.EndTime.ToString(@"HH\:mm"),
        s.GroupMemberId,
        s.GroupMember?.Name,
        s.GroupMember?.Color,
        s.GroupMember?.AvatarInitial,
        s.Location,
        s.Notes,
        s.CreatedAt
    );

    private IQueryable<ScheduleItem> WithIncludes() =>
        db.ScheduleItems.Include(s => s.GroupMember);

    public async Task<List<ScheduleItemDto>> GetAllAsync() =>
        await WithIncludes()
              .OrderBy(s => s.Date).ThenBy(s => s.StartTime)
              .Select(s => ToDto(s))
              .ToListAsync();

    public async Task<ScheduleItemDto> CreateAsync(CreateScheduleItemDto dto)
    {
        var date = dto.Date.Date;
        if (date < WeekStart || date > WeekEnd.Date)
            throw new ArgumentException("Date must be within April 6-10, 2026.");

        if (!TimeSpan.TryParse(dto.StartTime, out var start))
            throw new ArgumentException("Invalid StartTime format. Use HH:mm.");
        if (!TimeSpan.TryParse(dto.EndTime, out var end))
            throw new ArgumentException("Invalid EndTime format. Use HH:mm.");

        var item = new ScheduleItem
        {
            Title = dto.Title,
            ScheduleCategory = dto.Category,
            Date = date,
            StartTime = start,
            EndTime = end,
            GroupMemberId = dto.GroupMemberId,
            Location = dto.Location,
            Notes = dto.Notes,
            CreatedAt = DateTime.UtcNow,
        };

        db.ScheduleItems.Add(item);
        await db.SaveChangesAsync();

        var saved = await WithIncludes().FirstAsync(s => s.Id == item.Id);
        return ToDto(saved);
    }

    public async Task<ScheduleItemDto?> UpdateAsync(int id, UpdateScheduleItemDto dto)
    {
        var item = await db.ScheduleItems.FindAsync(id);
        if (item is null) return null;

        var date = dto.Date.Date;
        if (date < WeekStart || date > WeekEnd.Date)
            throw new ArgumentException("Date must be within April 6-10, 2026.");

        if (!TimeSpan.TryParse(dto.StartTime, out var start))
            throw new ArgumentException("Invalid StartTime format. Use HH:mm.");
        if (!TimeSpan.TryParse(dto.EndTime, out var end))
            throw new ArgumentException("Invalid EndTime format. Use HH:mm.");

        item.Title = dto.Title;
        item.ScheduleCategory = dto.Category;
        item.Date = date;
        item.StartTime = start;
        item.EndTime = end;
        item.GroupMemberId = dto.GroupMemberId;
        item.Location = dto.Location;
        item.Notes = dto.Notes;

        await db.SaveChangesAsync();

        var saved = await WithIncludes().FirstAsync(s => s.Id == id);
        return ToDto(saved);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var item = await db.ScheduleItems.FindAsync(id);
        if (item is null) return false;
        db.ScheduleItems.Remove(item);
        await db.SaveChangesAsync();
        return true;
    }
}
