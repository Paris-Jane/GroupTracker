using Microsoft.AspNetCore.Mvc;
using ProjectHub.API.DTOs;
using ProjectHub.API.Models;
using ProjectHub.API.Services;
using TaskStatus = ProjectHub.API.Models.TaskStatus;

namespace ProjectHub.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TasksController(TaskService taskService) : ControllerBase
{
    // ── Task CRUD ──────────────────────────────────────────────────────────

    [HttpGet]
    public async Task<IActionResult> GetAll() =>
        Ok(await taskService.GetAllAsync());

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var task = await taskService.GetByIdAsync(id);
        return task is null ? NotFound() : Ok(task);
    }

    /// <summary>Returns tasks assigned to a specific group member.</summary>
    [HttpGet("member/{memberId}")]
    public async Task<IActionResult> GetByMember(int memberId) =>
        Ok(await taskService.GetByMemberAsync(memberId));

    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateTaskItemDto dto,
        [FromQuery] int? actorId = null)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest("Task name is required.");
        var created = await taskService.CreateAsync(dto, actorId);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(
        int id,
        [FromBody] UpdateTaskItemDto dto,
        [FromQuery] int? actorId = null)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest("Task name is required.");
        var updated = await taskService.UpdateAsync(id, dto, actorId);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var deleted = await taskService.DeleteAsync(id);
        return deleted ? NoContent() : NotFound();
    }

    // ── Status & Assignment ────────────────────────────────────────────────

    [HttpPatch("{id}/status")]
    public async Task<IActionResult> UpdateStatus(
        int id,
        [FromBody] UpdateTaskStatusDto dto,
        [FromQuery] int? actorId = null)
    {
        var result = await taskService.UpdateStatusAsync(id, dto.Status, actorId);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPut("{id}/assign")]
    public async Task<IActionResult> Assign(
        int id,
        [FromBody] AssignTaskDto dto,
        [FromQuery] int? actorId = null)
    {
        var result = await taskService.AssignAsync(id, dto.MemberIds, actorId);
        return result is null ? NotFound() : Ok(result);
    }

    // ── Subtasks ───────────────────────────────────────────────────────────

    [HttpPost("{taskId}/subtasks")]
    public async Task<IActionResult> CreateSubtask(int taskId, [FromBody] CreateSubtaskDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest("Subtask name is required.");
        var sub = await taskService.CreateSubtaskAsync(taskId, dto);
        return sub is null ? NotFound("Task not found.") : CreatedAtAction(nameof(GetById), new { id = taskId }, sub);
    }

    [HttpPut("subtasks/{subtaskId}")]
    public async Task<IActionResult> UpdateSubtask(int subtaskId, [FromBody] UpdateSubtaskDto dto)
    {
        var sub = await taskService.UpdateSubtaskAsync(subtaskId, dto);
        return sub is null ? NotFound() : Ok(sub);
    }

    [HttpDelete("subtasks/{subtaskId}")]
    public async Task<IActionResult> DeleteSubtask(int subtaskId)
    {
        var deleted = await taskService.DeleteSubtaskAsync(subtaskId);
        return deleted ? NoContent() : NotFound();
    }

    // ── Recent Updates ─────────────────────────────────────────────────────

    [HttpGet("updates/recent")]
    public async Task<IActionResult> GetRecentUpdates([FromQuery] int count = 15) =>
        Ok(await taskService.GetRecentUpdatesAsync(Math.Clamp(count, 1, 50)));

    // ── Bulk Import ────────────────────────────────────────────────────────

    [HttpPost("bulk-import")]
    public async Task<IActionResult> BulkImport(
        [FromBody] List<BulkImportTaskDto> dtos,
        [FromQuery] int? actorId = null)
    {
        if (dtos is null || dtos.Count == 0)
            return BadRequest("No tasks provided.");
        var created = await taskService.BulkImportAsync(dtos, actorId);
        return Ok(created);
    }
}
