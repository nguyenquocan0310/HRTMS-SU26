namespace HRTMS.Core.Common;

public class ApiResponse<T>
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public T? Data { get; set; }

    // Mã lỗi ổn định để FE switch/case thay vì so khớp Message (Message là tiếng
    // Việt, có thể đổi). NULL với response thành công hoặc lỗi chưa được gán mã.
    public string? Error { get; set; }

    public static ApiResponse<T> Ok(T data, string message = "Success") =>
        new() { Success = true, Message = message, Data = data };

    public static ApiResponse<T> Fail(string message) =>
        new() { Success = false, Message = message };

    public static ApiResponse<T> Fail(string error, string message) =>
        new() { Success = false, Error = error, Message = message };
}
