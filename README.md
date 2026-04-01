# ProjectHub — Student Group Project Manager

A full-stack web app to help a student group organize tasks, resources, and workload.

## Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Frontend   | React 18 + TypeScript (Vite)        |
| Backend    | ASP.NET Core 8 Web API              |
| Database   | SQLite (via Entity Framework Core)  |
| Routing    | React Router v6                     |
| HTTP       | Axios                               |

---

## Project Structure

```
intex2/
├── ProjectHub.API/          ← ASP.NET Core backend
│   ├── Controllers/         ← REST API controllers
│   ├── Data/                ← DbContext + seed data
│   ├── DTOs/                ← Data Transfer Objects
│   ├── Models/              ← Entity models
│   ├── Services/            ← Business logic
│   └── Program.cs           ← App setup & middleware
│
└── project-hub-frontend/    ← React frontend
    └── src/
        ├── api/             ← Axios API client
        ├── components/      ← Reusable components
        │   ├── common/      ← Avatar, badges, dialogs
        │   └── Tasks/       ← BulkImportModal
        ├── pages/           ← DashboardPage, TasksPage, ResourcesPage, PlayGamePage
        └── types/           ← TypeScript interfaces
```

---

## Running Locally

### Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8)
- [Node.js 18+](https://nodejs.org/)

### 1. Start the Backend

```bash
cd ProjectHub.API
dotnet run
```

The API starts at **http://localhost:5156**  
The SQLite database (`projecthub.db`) is created automatically on first run.  
Demo seed data is inserted automatically if the database is empty.

### 2. Start the Frontend

```bash
cd project-hub-frontend
npm install        # only needed once
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## Features

### Dashboard
- Summary cards (total / completed / in-progress / overdue)
- Overall progress bar
- My tasks (filtered to current user)
- Upcoming deadlines (next 7 days)
- Recent activity log (last 15 updates)
- Quick links preview
- This week's room reservations

### Tasks Page
- Create, edit, delete tasks
- Status: Not Started / Working On It / Completed
- Priority: High / Medium / Low
- Required / Optional flag
- Deadline, estimated time, tags
- Multi-person assignment
- Subtasks with per-subtask checkboxes and progress bar
- Filter by: All / Mine / Incomplete / Completed
- Filter by priority
- Sort by: Deadline / Priority / Name / Last Updated
- Full-text search
- Assign to self with one click
- Overdue highlighting

### Bulk Import via AI
1. Copy the built-in AI prompt
2. Paste into any AI (ChatGPT, Claude, etc.) with your rubric
3. Paste the AI's JSON response back into the app
4. Preview tasks before importing
5. Import all at once

### Resources Page
- **Quick Links** — add links with title, URL, category, notes; grouped by category
- **Materials** — teacher-provided or other resources with descriptions, categories, links
- **Room Reservations** — weekly calendar view + list; add/edit/delete reservations

### Play Game — Fair Task Assignment
1. Each member rates their confidence (1–10) for every task
2. Results screen shows rating bars for all members per task
3. Group can assign tasks to the highest scorer or anyone else

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/groupmembers` | List all members |
| POST | `/api/groupmembers` | Add member |
| PUT | `/api/groupmembers/{id}` | Update member |
| DELETE | `/api/groupmembers/{id}` | Delete member |
| GET | `/api/tasks` | All tasks |
| GET | `/api/tasks/{id}` | Single task |
| GET | `/api/tasks/member/{memberId}` | Tasks assigned to member |
| POST | `/api/tasks` | Create task |
| PUT | `/api/tasks/{id}` | Update task |
| DELETE | `/api/tasks/{id}` | Delete task |
| PATCH | `/api/tasks/{id}/status` | Update status |
| PUT | `/api/tasks/{id}/assign` | Set assignees |
| POST | `/api/tasks/{taskId}/subtasks` | Add subtask |
| PUT | `/api/tasks/subtasks/{id}` | Update subtask |
| DELETE | `/api/tasks/subtasks/{id}` | Delete subtask |
| GET | `/api/tasks/updates/recent` | Recent activity log |
| POST | `/api/tasks/bulk-import` | Bulk import tasks |
| GET | `/api/resources/links` | All quick links |
| POST | `/api/resources/links` | Add link |
| PUT | `/api/resources/links/{id}` | Update link |
| DELETE | `/api/resources/links/{id}` | Delete link |
| GET | `/api/resources/items` | All resource items |
| POST | `/api/resources/items` | Add resource |
| PUT | `/api/resources/items/{id}` | Update resource |
| DELETE | `/api/resources/items/{id}` | Delete resource |
| GET | `/api/resources/reservations` | All reservations |
| POST | `/api/resources/reservations` | Add reservation |
| PUT | `/api/resources/reservations/{id}` | Update reservation |
| DELETE | `/api/resources/reservations/{id}` | Delete reservation |
| POST | `/api/game/tasks/{taskId}/rate` | Submit rating |
| GET | `/api/game/results` | All rating summaries |
| GET | `/api/game/tasks/{taskId}/results` | Single task results |

---

## Switching to SQL Server or PostgreSQL

1. Replace the SQLite package with the appropriate provider:
   - SQL Server: `Microsoft.EntityFrameworkCore.SqlServer`
   - PostgreSQL: `Npgsql.EntityFrameworkCore.PostgreSQL`

2. In `Program.cs`, change `UseSqlite(...)` to `UseSqlServer(...)` or `UseNpgsql(...)`

3. Update the connection string in `appsettings.json`

4. Run `dotnet ef migrations add Initial` and `dotnet ef database update`

---

## Seed Data

On first run the app creates 4 demo group members, 7 tasks with subtasks and assignments, quick links, resources, and room reservations so you can immediately explore all features.
