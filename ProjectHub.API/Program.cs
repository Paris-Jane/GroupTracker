using Microsoft.EntityFrameworkCore;
using ProjectHub.API.Data;
using ProjectHub.API.Services;

var builder = WebApplication.CreateBuilder(args);

// ── Services ───────────────────────────────────────────────────────────────

builder.Services.AddControllers()
    .AddJsonOptions(opts =>
    {
        // Serialize enums as readable strings (e.g. "High" instead of 1)
        opts.JsonSerializerOptions.Converters.Add(
            new System.Text.Json.Serialization.JsonStringEnumConverter());
    });

// SQLite database — swap the connection string + provider package for
// SQL Server ("Server=...;Database=...") or PostgreSQL ("Host=...;Database=...")
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

// Scoped application services
builder.Services.AddScoped<TaskService>();
builder.Services.AddScoped<ResourceService>();
builder.Services.AddScoped<GameService>();

// CORS: allow the React dev server (port 5173) in local development
builder.Services.AddCors(options =>
    options.AddPolicy("DevCors", policy =>
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod()));

var app = builder.Build();

// ── Middleware ─────────────────────────────────────────────────────────────

app.UseCors("DevCors");
app.UseAuthorization();
app.MapControllers();

// ── Database setup & seeding ───────────────────────────────────────────────

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();   // Creates the SQLite file + schema on first run
    SeedData.Initialize(db);       // Inserts demo data if the DB is empty
}

app.Run();
