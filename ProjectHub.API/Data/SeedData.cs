using ProjectHub.API.Models;
using TaskStatus = ProjectHub.API.Models.TaskStatus;

namespace ProjectHub.API.Data;

/// <summary>
/// Seeds demo data so the app is immediately usable after first run.
/// Only seeds if the database is empty.
/// </summary>
public static class SeedData
{
    public static void Initialize(AppDbContext context)
    {
        if (context.GroupMembers.Any()) return; // already seeded

        // ── Group Members ──────────────────────────────────────────────
        var members = new List<GroupMember>
        {
            new() { Name = "Alex Johnson",  AvatarInitial = "A", Color = "#4A90D9", Email = "alex@example.com" },
            new() { Name = "Jordan Smith",  AvatarInitial = "J", Color = "#E67E22", Email = "jordan@example.com" },
            new() { Name = "Taylor Brown",  AvatarInitial = "T", Color = "#27AE60", Email = "taylor@example.com" },
            new() { Name = "Morgan Lee",    AvatarInitial = "M", Color = "#8E44AD", Email = "morgan@example.com" },
        };
        context.GroupMembers.AddRange(members);
        context.SaveChanges();

        // ── Quick Links ────────────────────────────────────────────────
        context.QuickLinks.AddRange(
            new QuickLink { Title = "Google Drive Folder",  Url = "https://drive.google.com",   Category = "Project Files",  Notes = "Shared team folder" },
            new QuickLink { Title = "Project Brief",        Url = "https://docs.google.com",    Category = "Project Files",  Notes = "Official assignment brief" },
            new QuickLink { Title = "Figma Mockups",        Url = "https://figma.com",          Category = "Design",         Notes = "UI wireframes" },
            new QuickLink { Title = "GitHub Repo",          Url = "https://github.com",         Category = "Development",    Notes = "Source code" },
            new QuickLink { Title = "Research Paper 1",     Url = "https://scholar.google.com", Category = "Research",       Notes = "Background reading" }
        );

        // ── Resource Items ─────────────────────────────────────────────
        context.ResourceItems.AddRange(
            new ResourceItem { Title = "Rubric",            Type = ResourceType.TeacherProvided, Category = "Grading",   Notes = "Final project rubric",  Description = "Grading criteria from professor" },
            new ResourceItem { Title = "Example Report",    Type = ResourceType.TeacherProvided, Category = "Templates", Notes = "Previous year example", Description = "Reference for report structure" },
            new ResourceItem { Title = "Style Guide",       Type = ResourceType.Other,           Category = "Standards", Notes = "APA formatting",        Description = "Citation and formatting guide" }
        );

        // ── Room Reservations ──────────────────────────────────────────
        var today = DateTime.UtcNow.Date;
        context.RoomReservations.AddRange(
            new RoomReservation
            {
                RoomName = "Library Study Room 3",
                Date = today.AddDays(1),
                StartTime = new TimeSpan(14, 0, 0),
                EndTime = new TimeSpan(16, 0, 0),
                GroupMemberId = members[0].Id,
                ReservedBy = members[0].Name,
                Notes = "Sprint planning meeting"
            },
            new RoomReservation
            {
                RoomName = "Engineering Lab 201",
                Date = today.AddDays(3),
                StartTime = new TimeSpan(10, 0, 0),
                EndTime = new TimeSpan(12, 0, 0),
                GroupMemberId = members[1].Id,
                ReservedBy = members[1].Name,
                Notes = "Work on prototype"
            }
        );

        // ── Tasks ──────────────────────────────────────────────────────
        var tasks = new List<TaskItem>
        {
            new()
            {
                Name = "Define project scope and goals",
                Description = "Write a clear scope document covering objectives, deliverables, and constraints.",
                EstimatedTime = "2 hours",
                Deadline = today.AddDays(3),
                Priority = TaskPriority.High,
                IsRequired = true,
                Status = TaskStatus.Completed,
                Tags = "Planning",
                CreatedAt = DateTime.UtcNow.AddDays(-7),
                UpdatedAt = DateTime.UtcNow.AddDays(-5),
            },
            new()
            {
                Name = "Create wireframes / UI mockups",
                Description = "Sketch the main screens in Figma before development starts.",
                EstimatedTime = "3 hours",
                Deadline = today.AddDays(5),
                Priority = TaskPriority.High,
                IsRequired = true,
                Status = TaskStatus.WorkingOnIt,
                Tags = "Design",
                CreatedAt = DateTime.UtcNow.AddDays(-5),
                UpdatedAt = DateTime.UtcNow.AddDays(-1),
            },
            new()
            {
                Name = "Set up backend API project",
                Description = "Initialize ASP.NET Core project, configure SQLite, add EF Core.",
                EstimatedTime = "1.5 hours",
                Deadline = today.AddDays(2),
                Priority = TaskPriority.High,
                IsRequired = true,
                Status = TaskStatus.Completed,
                Tags = "Development,Backend",
                CreatedAt = DateTime.UtcNow.AddDays(-6),
                UpdatedAt = DateTime.UtcNow.AddDays(-4),
            },
            new()
            {
                Name = "Build frontend React app",
                Description = "Set up Vite + React + TypeScript, install React Router, create page shells.",
                EstimatedTime = "2 hours",
                Deadline = today.AddDays(4),
                Priority = TaskPriority.High,
                IsRequired = true,
                Status = TaskStatus.WorkingOnIt,
                Tags = "Development,Frontend",
                CreatedAt = DateTime.UtcNow.AddDays(-5),
                UpdatedAt = DateTime.UtcNow.AddDays(-2),
            },
            new()
            {
                Name = "Write final report",
                Description = "Draft, revise, and finalize the project report following the professor's template.",
                EstimatedTime = "5 hours",
                Deadline = today.AddDays(14),
                Priority = TaskPriority.High,
                IsRequired = true,
                Status = TaskStatus.NotStarted,
                Tags = "Documentation",
                CreatedAt = DateTime.UtcNow.AddDays(-3),
                UpdatedAt = DateTime.UtcNow.AddDays(-3),
            },
            new()
            {
                Name = "Prepare presentation slides",
                Description = "Create a slide deck for the final demo day presentation.",
                EstimatedTime = "3 hours",
                Deadline = today.AddDays(12),
                Priority = TaskPriority.Medium,
                IsRequired = true,
                Status = TaskStatus.NotStarted,
                Tags = "Presentation",
                CreatedAt = DateTime.UtcNow.AddDays(-2),
                UpdatedAt = DateTime.UtcNow.AddDays(-2),
            },
            new()
            {
                Name = "Peer review and testing",
                Description = "Each member tests the app and files any bugs.",
                EstimatedTime = "2 hours",
                Deadline = today.AddDays(10),
                Priority = TaskPriority.Medium,
                IsRequired = false,
                Status = TaskStatus.NotStarted,
                Tags = "Testing",
                CreatedAt = DateTime.UtcNow.AddDays(-1),
                UpdatedAt = DateTime.UtcNow.AddDays(-1),
            },
        };
        context.TaskItems.AddRange(tasks);
        context.SaveChanges();

        // ── Subtasks ───────────────────────────────────────────────────
        context.Subtasks.AddRange(
            // Task 0 – scope doc (completed)
            new Subtask { TaskItemId = tasks[0].Id, Name = "List all deliverables",       IsCompleted = true },
            new Subtask { TaskItemId = tasks[0].Id, Name = "Define out-of-scope items",    IsCompleted = true },
            new Subtask { TaskItemId = tasks[0].Id, Name = "Get team sign-off",            IsCompleted = true },
            // Task 1 – wireframes
            new Subtask { TaskItemId = tasks[1].Id, Name = "Sketch Dashboard",             IsCompleted = true },
            new Subtask { TaskItemId = tasks[1].Id, Name = "Sketch Tasks page",            IsCompleted = true },
            new Subtask { TaskItemId = tasks[1].Id, Name = "Sketch Resources page",        IsCompleted = false },
            new Subtask { TaskItemId = tasks[1].Id, Name = "Team review of mockups",       IsCompleted = false },
            // Task 4 – final report
            new Subtask { TaskItemId = tasks[4].Id, Name = "Write introduction",           IsCompleted = false },
            new Subtask { TaskItemId = tasks[4].Id, Name = "Write methodology section",    IsCompleted = false },
            new Subtask { TaskItemId = tasks[4].Id, Name = "Write results section",        IsCompleted = false },
            new Subtask { TaskItemId = tasks[4].Id, Name = "Proofread final draft",        IsCompleted = false }
        );

        // ── Task Assignments ───────────────────────────────────────────
        context.TaskAssignments.AddRange(
            new TaskAssignment { TaskItemId = tasks[0].Id, GroupMemberId = members[0].Id },
            new TaskAssignment { TaskItemId = tasks[1].Id, GroupMemberId = members[1].Id },
            new TaskAssignment { TaskItemId = tasks[2].Id, GroupMemberId = members[2].Id },
            new TaskAssignment { TaskItemId = tasks[3].Id, GroupMemberId = members[3].Id },
            new TaskAssignment { TaskItemId = tasks[3].Id, GroupMemberId = members[2].Id }, // two assignees
            new TaskAssignment { TaskItemId = tasks[4].Id, GroupMemberId = members[0].Id },
            new TaskAssignment { TaskItemId = tasks[5].Id, GroupMemberId = members[1].Id }
        );

        // ── Task Updates (activity log) ────────────────────────────────
        context.TaskUpdates.AddRange(
            new TaskUpdate { TaskItemId = tasks[0].Id, GroupMemberId = members[0].Id, ActionType = "Created",       Message = "Task created",                        CreatedAt = DateTime.UtcNow.AddDays(-7) },
            new TaskUpdate { TaskItemId = tasks[0].Id, GroupMemberId = members[0].Id, ActionType = "StatusChanged", Message = "Status changed to Completed",         CreatedAt = DateTime.UtcNow.AddDays(-5) },
            new TaskUpdate { TaskItemId = tasks[2].Id, GroupMemberId = members[2].Id, ActionType = "Created",       Message = "Task created",                        CreatedAt = DateTime.UtcNow.AddDays(-6) },
            new TaskUpdate { TaskItemId = tasks[2].Id, GroupMemberId = members[2].Id, ActionType = "StatusChanged", Message = "Status changed to Completed",         CreatedAt = DateTime.UtcNow.AddDays(-4) },
            new TaskUpdate { TaskItemId = tasks[1].Id, GroupMemberId = members[1].Id, ActionType = "Created",       Message = "Task created",                        CreatedAt = DateTime.UtcNow.AddDays(-5) },
            new TaskUpdate { TaskItemId = tasks[1].Id, GroupMemberId = members[1].Id, ActionType = "Assigned",      Message = "Assigned to Jordan Smith",            CreatedAt = DateTime.UtcNow.AddDays(-4) },
            new TaskUpdate { TaskItemId = tasks[1].Id, GroupMemberId = members[1].Id, ActionType = "StatusChanged", Message = "Status changed to Working On It",     CreatedAt = DateTime.UtcNow.AddDays(-1) },
            new TaskUpdate { TaskItemId = tasks[3].Id, GroupMemberId = members[3].Id, ActionType = "Created",       Message = "Task created",                        CreatedAt = DateTime.UtcNow.AddDays(-5) },
            new TaskUpdate { TaskItemId = tasks[3].Id, GroupMemberId = members[2].Id, ActionType = "Assigned",      Message = "Assigned to Taylor Brown",            CreatedAt = DateTime.UtcNow.AddDays(-3) },
            new TaskUpdate { TaskItemId = tasks[4].Id, GroupMemberId = members[0].Id, ActionType = "Created",       Message = "Task created",                        CreatedAt = DateTime.UtcNow.AddDays(-3) },
            new TaskUpdate { TaskItemId = tasks[5].Id, GroupMemberId = members[1].Id, ActionType = "Created",       Message = "Task created",                        CreatedAt = DateTime.UtcNow.AddDays(-2) },
            new TaskUpdate { TaskItemId = tasks[6].Id, GroupMemberId = members[0].Id, ActionType = "Created",       Message = "Task created",                        CreatedAt = DateTime.UtcNow.AddDays(-1) }
        );

        // ── Task Ratings (sample "Play Game" data) ─────────────────────
        context.TaskRatings.AddRange(
            new TaskRating { TaskItemId = tasks[4].Id, GroupMemberId = members[0].Id, RatingValue = 8 },
            new TaskRating { TaskItemId = tasks[4].Id, GroupMemberId = members[1].Id, RatingValue = 6 },
            new TaskRating { TaskItemId = tasks[4].Id, GroupMemberId = members[2].Id, RatingValue = 5 },
            new TaskRating { TaskItemId = tasks[4].Id, GroupMemberId = members[3].Id, RatingValue = 7 },
            new TaskRating { TaskItemId = tasks[5].Id, GroupMemberId = members[0].Id, RatingValue = 7 },
            new TaskRating { TaskItemId = tasks[5].Id, GroupMemberId = members[1].Id, RatingValue = 9 }
        );

        context.SaveChanges();
    }
}
