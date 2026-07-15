# Race Allocate Issue - Debugging Guide

## Issue Summary
- After allocating pairings to race, entries don't display in Race Operations UI
- Swagger shows success but no data displayed to team members
- Admin sees working via Swagger but team members see nothing

## Root Causes Identified

### 1. Authorization Check (PRIMARY ISSUE)
**Location**: [TournamentController.cs](./backend/HRTMS.API/Controllers/TournamentController.cs#L213)

```csharp
// If race not drawn AND user is NOT admin → return EMPTY array
if (!race.IsPostPositionDrawn && !isAdmin)
    return Ok(new { success = true, message = "...", data = Array.Empty<object>() });
```

**Impact**:
- Non-admin team members cannot see entries until race post positions are drawn
- Even after successful allocation, non-admin users get empty response
- Frontend shows "Chưa có pairing nào được allocate" (No pairings allocated)

### 2. Frontend Silent Error Handling
**Location**: [RaceOperation.tsx](./frontend/src/pages/admin/RaceOperation.tsx#L60)

**Before Fix**:
```typescript
.catch(() => setEntries([]))  // No error message displayed
```

**Issue**: When fetch fails (auth, server error, etc.), no error message shown to user

### 3. Workflow Sequence
1. Admin allocates pairing → creates RaceEntry (Status="Pending")
2. Admin/Team calls GET /races/{raceId}/entries
3. Backend checks: `if (!drawn && !isAdmin) return empty`
4. Non-admin users see empty array → no entries displayed

## Fixes Applied

### Backend Fix
- **Improved OrderBy** to handle NULL PostPosition values
- Entries created but not yet drawn (PostPosition=null) now order correctly
- Admin can view entries anytime (even before draw)

### Frontend Fix
- **Added error message display** in reloadEntries()
- Now shows actual error reason (authorization, server error, etc.)
- Users can see why entries are empty

```typescript
.catch((err) => {
  setEntries([]);
  setActionError(err instanceof Error ? err.message : 'Không thể tải danh sách entry.');
})
```

## Diagnosis Checklist

### ✓ Test Admin Access
1. Log in as admin user
2. Go to Race Operations
3. Select tournament → select race
4. Allocate pairing using "Allocate" button
5. **Verify**: Entries appear in "Pairing đã allocate vào race" section
6. **Expected**: Entry shows with Status "Pending" and Gate "—" (null)

### ✓ Test Non-Admin Access  
1. Log in as team member (non-admin)
2. Go to Race Operations
3. Try to allocate
4. **Expected**: Should get 403 Forbidden error (requires Admin role)
   - OR see error message "Unauthorized" if previous step succeeds

### ✓ Test After Draw
1. As admin: Draw post positions
2. Check `race.IsPostPositionDrawn` is now TRUE
3. As non-admin: Fetch entries again
4. **Verify**: Non-admin can now see entries with PostPosition assigned

## Solutions (Choose One)

### Option 1: Assign Admin Role (Recommended for now)
If team members should allocate races:
```sql
-- Add Admin role to team member user
INSERT INTO AspNetUserRoles (UserId, RoleId) 
SELECT u.Id, r.Id FROM AspNetUsers u, AspNetRoles r
WHERE u.Email = 'team-member@example.com' AND r.Name = 'Admin'
```

### Option 2: Remove Authorization Check
**Not recommended** - makes post positions public before draw. But if intended:
- Remove the `if (!race.IsPostPositionDrawn && !isAdmin)` check
- Let everyone see entries after allocation

### Option 3: Create RaceOperator Role
Create new role with specific permissions:
- Allow allocation (allocate pairings)
- Allow viewing entries (before and after draw)
- Restrict other admin functions

## Verification Steps

After applying fix:

1. **Build backend**:
   ```bash
   dotnet build HRTMS-SU26/backend/HRTMS.sln
   ```

2. **Test allocate endpoint**:
   - Open [Swagger](http://localhost:5222/swagger)
   - POST `/admin/races/{raceId}/entries` with valid pairingId
   - Verify 201 Created response

3. **Test get entries endpoint**:
   - GET `/races/{raceId}/entries` as admin
   - Should see entries list even if IsPostPositionDrawn=false
   
4. **Test frontend**:
   - Allocate pairings
   - Refresh page or wait for auto-reload
   - Verify entries appear in right panel
   - Verify error messages display if fetch fails

## Files Modified

1. **Backend**:
   - [TournamentController.cs](./backend/HRTMS.API/Controllers/TournamentController.cs) - Improved OrderBy

2. **Frontend**:
   - [RaceOperation.tsx](./frontend/src/pages/admin/RaceOperation.tsx) - Better error handling

## Next Steps

1. **Confirm team member roles**: Are they admin or staff-only?
2. **Choose solution**: Pick Option 1, 2, or 3 based on intended behavior
3. **Test thoroughly**: Verify both admin and non-admin workflows
4. **Monitor**: Watch for authorization-related errors in browser console

## Questions to Ask

- [ ] Should non-admin team members be able to allocate? (requires Admin role or new role)
- [ ] Should non-admin users see entries before post positions drawn?
- [ ] Is the "Admin Workspace" restricted to admin users only?
- [ ] Were team members recently removed from Admin role?

---

**Date**: 2026-07-15  
**Status**: Partially Fixed - Awaiting team member role configuration
