using System.ComponentModel.DataAnnotations;

namespace HRTMS.Core.Common;

public class AllowedValuesAttribute : ValidationAttribute
{
    private readonly string[] _allowed;

    public AllowedValuesAttribute(params string[] allowed)
    {
        _allowed = allowed;
    }

    protected override ValidationResult? IsValid(object? value, ValidationContext ctx)
    {
        if (value is string s && !_allowed.Contains(s))
        {
            string list = string.Join(", ", _allowed);
            return new ValidationResult(
                $"Giá trị '{s}' không hợp lệ cho {ctx.DisplayName}. Chỉ chấp nhận: {list}.");
        }
        return ValidationResult.Success;
    }
}
