using Microsoft.AspNetCore.Mvc;
using ProjectHub.API.DTOs;
using ProjectHub.API.Services;

namespace ProjectHub.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class GameController(GameService gameService) : ControllerBase
{
    /// <summary>Submit or update a rating (1–10) for a task by a group member.</summary>
    [HttpPost("tasks/{taskId}/rate")]
    public async Task<IActionResult> SubmitRating(int taskId, [FromBody] SubmitRatingDto dto)
    {
        if (dto.RatingValue < 1 || dto.RatingValue > 10)
            return BadRequest("Rating must be between 1 and 10.");
        try
        {
            var result = await gameService.SubmitRatingAsync(taskId, dto);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
    }

    /// <summary>Get rating summaries for all tasks — used for the results/assignment screen.</summary>
    [HttpGet("results")]
    public async Task<IActionResult> GetAllResults() =>
        Ok(await gameService.GetRatingSummariesAsync());

    /// <summary>Get rating summary for a single task.</summary>
    [HttpGet("tasks/{taskId}/results")]
    public async Task<IActionResult> GetTaskResults(int taskId)
    {
        var result = await gameService.GetRatingSummaryForTaskAsync(taskId);
        return result is null ? NotFound() : Ok(result);
    }
}
