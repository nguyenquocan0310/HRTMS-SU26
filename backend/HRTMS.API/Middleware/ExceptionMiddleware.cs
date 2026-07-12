using System.Net;
using System.Text.Json;
using HRTMS.Core.Common;
using Microsoft.EntityFrameworkCore;

namespace HRTMS.API.Middleware;

public class ExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionMiddleware> _logger;

    public ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception: {Message}", ex.Message);
            await HandleExceptionAsync(context, ex);
        }
    }

    private static Task HandleExceptionAsync(HttpContext context, Exception ex)
    {
        context.Response.ContentType = "application/json";

        // Optimistic concurrency (RowVersion trên Race/RaceEntry): request sau
        // ghi đè bản ghi đã bị request khác thay đổi → 409, client tải lại rồi thử lại.
        if (ex is DbUpdateConcurrencyException)
        {
            context.Response.StatusCode = (int)HttpStatusCode.Conflict;
            return context.Response.WriteAsync(JsonSerializer.Serialize(new
            {
                error = "CONCURRENCY_CONFLICT",
                message = "Dữ liệu vừa bị người khác thay đổi, vui lòng tải lại rồi thử lại."
            }));
        }

        context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;

        var response = ApiResponse<object>.Fail("Đã xảy ra lỗi hệ thống. Vui lòng thử lại.");
        return context.Response.WriteAsync(JsonSerializer.Serialize(response));
    }
}
