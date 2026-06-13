using HRTMS.Core.Entities;

namespace HRTMS.Core.Interfaces.Repositories;

public interface IUserRepository
{
    Task<User?> GetByEmailAsync(string email);
    Task<bool> ExistsAsync(string email, string username);
    Task<User> CreateAsync(User user);
}
