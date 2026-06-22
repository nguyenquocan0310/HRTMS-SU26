using HRTMS.API.Extensions;
using HRTMS.API.Middleware;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDatabaseServices(builder.Configuration);
builder.Services.AddApplicationServices();
builder.Services.AddJwtAuth(builder.Configuration);
builder.Services.AddCorsPolicy();
builder.Services.AddSwaggerServices();
builder.Services.AddHangfireJobs(builder.Configuration);
builder.Services.AddControllers();
builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = builder.Configuration.GetConnectionString("Redis");
    options.InstanceName = "HRTMS:";
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseMiddleware<ExceptionMiddleware>();
app.UseCors("AllowFrontend");
app.UseHttpsRedirection();
app.UseAuthentication();

// EC-29: phải đứng SAU UseAuthentication (cần đọc token)
// và TRƯỚC UseAuthorization (để chặn trước khi vào controller)
app.UseMiddleware<TokenBlacklistMiddleware>();

app.UseAuthorization();
app.MapControllers();
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<HRTMSDbContext>();
        context.Database.Migrate();
        System.Console.WriteLine("--> THÀNH CÔNG: Đã tự động cập nhật cấu trúc bảng Database đích danh!");
    }
    catch (System.Exception ex)
    {
        System.Console.WriteLine($"--> LỖI MIGRATION TỰ ĐỘNG: {ex.Message}");
    }
}
app.Run();