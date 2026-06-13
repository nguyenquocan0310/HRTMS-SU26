using HRTMS.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HRTMS.API.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase
{
    private readonly HRTMSDbContext _context;

    public AdminController(HRTMSDbContext context)
    {
        _context = context;
    }

    [HttpPatch("users/{id}/suspend")]
    public async Task<IActionResult> SuspendUser(int id)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound();

        user.Status = "Suspended";
        user.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok();
    }

    [HttpPatch("referees/{id}/approve")]
    public async Task<IActionResult> ApproveReferee(int id)
    {
        var profile = await _context.RefereeProfiles.FindAsync(id);
        if (profile == null) return NotFound();

        profile.Status = "Approved";
        profile.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok();
    }
}