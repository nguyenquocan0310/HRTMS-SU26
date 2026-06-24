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
        // DB-first: schema quản lý bằng database/hrtms_schema.sql + patches.
        // KHÔNG dùng EF migrations (tránh tạo bảng __EFMigrationsHistory & xung đột schema).
        // Chỉ kiểm tra kết nối DB lúc khởi động.
        if (context.Database.CanConnect())
            System.Console.WriteLine("--> DB OK: kết nối tới HRTMS thành công.");
        else
            System.Console.WriteLine("--> CẢNH BÁO: không kết nối được DB. Hãy chạy hrtms_schema.sql + patches.");
    }
    catch (System.Exception ex)
    {
        System.Console.WriteLine($"--> LỖI KIỂM TRA KẾT NỐI DB: {ex.Message}");
    }
}
app.Run();