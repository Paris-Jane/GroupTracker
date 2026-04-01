using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectHub.API.Data;
using ProjectHub.API.DTOs;

namespace ProjectHub.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController(AppDbContext db) : ControllerBase
{
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequestDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Username) || string.IsNullOrWhiteSpace(dto.Password))
            return BadRequest("Username and password are required.");

        var member = await db.GroupMembers.FirstOrDefaultAsync(m =>
            m.Username == dto.Username.ToLower() &&
            m.Password == dto.Password.ToLower());

        if (member is null)
            return Unauthorized("Invalid username or password.");

        return Ok(new GroupMemberDto(member.Id, member.Name, member.Email, member.AvatarInitial, member.Color, member.Username));
    }
}
