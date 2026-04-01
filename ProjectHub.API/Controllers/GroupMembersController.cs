using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectHub.API.Data;
using ProjectHub.API.DTOs;
using ProjectHub.API.Models;

namespace ProjectHub.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class GroupMembersController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll() =>
        Ok(await db.GroupMembers
            .Select(m => new GroupMemberDto(m.Id, m.Name, m.Email, m.AvatarInitial, m.Color))
            .ToListAsync());

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var m = await db.GroupMembers.FindAsync(id);
        return m is null ? NotFound() : Ok(new GroupMemberDto(m.Id, m.Name, m.Email, m.AvatarInitial, m.Color));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateGroupMemberDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest("Name is required.");

        var member = new GroupMember
        {
            Name = dto.Name,
            Email = dto.Email,
            AvatarInitial = dto.AvatarInitial ?? dto.Name[..1].ToUpper(),
            Color = dto.Color ?? "#4A90D9"
        };
        db.GroupMembers.Add(member);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = member.Id },
            new GroupMemberDto(member.Id, member.Name, member.Email, member.AvatarInitial, member.Color));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateGroupMemberDto dto)
    {
        var member = await db.GroupMembers.FindAsync(id);
        if (member is null) return NotFound();

        member.Name = dto.Name;
        member.Email = dto.Email;
        member.AvatarInitial = dto.AvatarInitial;
        member.Color = dto.Color;
        await db.SaveChangesAsync();
        return Ok(new GroupMemberDto(member.Id, member.Name, member.Email, member.AvatarInitial, member.Color));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var member = await db.GroupMembers.FindAsync(id);
        if (member is null) return NotFound();
        db.GroupMembers.Remove(member);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
