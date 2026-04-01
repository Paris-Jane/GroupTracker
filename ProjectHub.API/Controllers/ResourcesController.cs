using Microsoft.AspNetCore.Mvc;
using ProjectHub.API.DTOs;
using ProjectHub.API.Services;

namespace ProjectHub.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ResourcesController(ResourceService resourceService) : ControllerBase
{
    // ── Quick Links ────────────────────────────────────────────────────────

    [HttpGet("links")]
    public async Task<IActionResult> GetLinks() =>
        Ok(await resourceService.GetAllLinksAsync());

    [HttpPost("links")]
    public async Task<IActionResult> CreateLink([FromBody] CreateQuickLinkDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Title) || string.IsNullOrWhiteSpace(dto.Url))
            return BadRequest("Title and URL are required.");
        return Ok(await resourceService.CreateLinkAsync(dto));
    }

    [HttpPut("links/{id}")]
    public async Task<IActionResult> UpdateLink(int id, [FromBody] UpdateQuickLinkDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Title) || string.IsNullOrWhiteSpace(dto.Url))
            return BadRequest("Title and URL are required.");
        var result = await resourceService.UpdateLinkAsync(id, dto);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpDelete("links/{id}")]
    public async Task<IActionResult> DeleteLink(int id)
    {
        var deleted = await resourceService.DeleteLinkAsync(id);
        return deleted ? NoContent() : NotFound();
    }

    // ── Resource Items ─────────────────────────────────────────────────────

    [HttpGet("items")]
    public async Task<IActionResult> GetItems() =>
        Ok(await resourceService.GetAllResourcesAsync());

    [HttpPost("items")]
    public async Task<IActionResult> CreateItem([FromBody] CreateResourceItemDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Title))
            return BadRequest("Title is required.");
        return Ok(await resourceService.CreateResourceAsync(dto));
    }

    [HttpPut("items/{id}")]
    public async Task<IActionResult> UpdateItem(int id, [FromBody] UpdateResourceItemDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Title))
            return BadRequest("Title is required.");
        var result = await resourceService.UpdateResourceAsync(id, dto);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpDelete("items/{id}")]
    public async Task<IActionResult> DeleteItem(int id)
    {
        var deleted = await resourceService.DeleteResourceAsync(id);
        return deleted ? NoContent() : NotFound();
    }

    // ── Room Reservations ──────────────────────────────────────────────────

    [HttpGet("reservations")]
    public async Task<IActionResult> GetReservations() =>
        Ok(await resourceService.GetReservationsAsync());

    [HttpPost("reservations")]
    public async Task<IActionResult> CreateReservation([FromBody] CreateRoomReservationDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.RoomName))
            return BadRequest("Room name is required.");
        try
        {
            var result = await resourceService.CreateReservationAsync(dto);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPut("reservations/{id}")]
    public async Task<IActionResult> UpdateReservation(int id, [FromBody] UpdateRoomReservationDto dto)
    {
        try
        {
            var result = await resourceService.UpdateReservationAsync(id, dto);
            return result is null ? NotFound() : Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpDelete("reservations/{id}")]
    public async Task<IActionResult> DeleteReservation(int id)
    {
        var deleted = await resourceService.DeleteReservationAsync(id);
        return deleted ? NoContent() : NotFound();
    }
}
