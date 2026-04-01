using Microsoft.AspNetCore.Mvc;
using ProjectHub.API.DTOs;
using ProjectHub.API.Services;

namespace ProjectHub.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SprintsController(SprintService sprintService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll() =>
        Ok(await sprintService.GetAllAsync());

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var sprint = await sprintService.GetByIdAsync(id);
        return sprint is null ? NotFound() : Ok(sprint);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateSprintDto dto)
    {
        var created = await sprintService.CreateAsync(dto);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateSprintDto dto)
    {
        var updated = await sprintService.UpdateAsync(id, dto);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var deleted = await sprintService.DeleteAsync(id);
        return deleted ? NoContent() : NotFound();
    }

    [HttpGet("{id}/reviews")]
    public async Task<IActionResult> GetReviews(int id) =>
        Ok(await sprintService.GetReviewsAsync(id));

    [HttpPost("{id}/reviews")]
    public async Task<IActionResult> AddReview(int id, [FromBody] CreateSprintReviewDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Content))
            return BadRequest("Content is required.");
        var review = await sprintService.AddReviewAsync(id, dto);
        return review is null ? NotFound("Sprint not found.") : Ok(review);
    }

    [HttpDelete("reviews/{reviewId}")]
    public async Task<IActionResult> DeleteReview(int reviewId)
    {
        var deleted = await sprintService.DeleteReviewAsync(reviewId);
        return deleted ? NoContent() : NotFound();
    }
}

[ApiController]
[Route("api/[controller]")]
public class SettingsController(SprintService sprintService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get() =>
        Ok(await sprintService.GetSettingsAsync());

    [HttpPut]
    public async Task<IActionResult> Update([FromBody] UpdateProjectSettingsDto dto) =>
        Ok(await sprintService.UpdateSettingsAsync(dto));
}
