using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace HRTMS.API.Extensions;

public static class SwaggerExtensions
{
    // Danh sách doc groups — mỗi entry = 1 trang Swagger riêng
    // Key   = docName (dùng trong URL: /swagger/{key}/swagger.json)
    // Value = tiêu đề hiển thị trong dropdown
    private static readonly Dictionary<string, string> Docs = new()
    {
        ["auth"] = "Module A — Auth & Account",
        ["tournament"] = "Module B — Tournament",
        ["horse"] = "Module C — Horse",
        ["jockey"] = "Module D — Jockey & Pairing",
        ["scheduling"] = "Module E — Scheduling & Draw",
        ["referee"] = "Module F — Referee & COI",
        ["prerace"] = "Module G — Pre-race Checks",
        ["race"] = "Module H — Race Live",
        ["results"] = "Module J/K — Results & Purse",
        ["leaderboard"] = "Module L/M/N — Leaderboard, Prediction & Reconciliation",
        ["notification"] = "Module O — Notification",
        ["admin"] = "Admin Tools",
    };

    public static IServiceCollection AddSwaggerServices(this IServiceCollection services)
    {
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen(c =>
        {
            // Tạo 1 SwaggerDoc cho mỗi group
            foreach (var (key, title) in Docs)
            {
                c.SwaggerDoc(key, new OpenApiInfo
                {
                    Title = title,
                    Version = "v1",
                    Description = $"HRTMS API — {title}"
                });
            }

            // Gom endpoint vào đúng doc dựa theo tag đầu tiên của nó
            c.DocInclusionPredicate((docName, apiDesc) =>
            {
                // [Tags] attribute nằm ở Microsoft.AspNetCore.Http.TagsAttribute (.NET 7+)
                var tags = apiDesc.ActionDescriptor.EndpointMetadata
                    .OfType<Microsoft.AspNetCore.Http.TagsAttribute>()
                    .SelectMany(t => t.Tags)
                    .ToList();

                if (tags.Count == 0) return docName == "admin"; // fallback
                return tags.Contains(docName);
            });

            // JWT Bearer — áp dụng toàn bộ
            c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
            {
                Name = "Authorization",
                Type = SecuritySchemeType.Http,
                Scheme = "Bearer",
                BearerFormat = "JWT",
                In = ParameterLocation.Header,
                Description = "Nhập token: Bearer {token}"
            });

            c.AddSecurityRequirement(new OpenApiSecurityRequirement
            {
                {
                    new OpenApiSecurityScheme
                    {
                        Reference = new OpenApiReference
                        {
                            Type = ReferenceType.SecurityScheme,
                            Id = "Bearer"
                        }
                    },
                    Array.Empty<string>()
                }
            });
        });

        return services;
    }

    public static IApplicationBuilder UseSwaggerWithUI(this IApplicationBuilder app)
    {
        app.UseSwagger();
        app.UseSwaggerUI(c =>
        {
            // Mỗi doc = 1 entry trong dropdown góc phải Swagger UI
            foreach (var (key, title) in Docs)
            {
                c.SwaggerEndpoint($"/swagger/{key}/swagger.json", title);
            }

            // Mặc định mở trang Auth khi vào /swagger
            c.RoutePrefix = "swagger";
        });

        return app;
    }
}
