# Weekly Reflection Bug Fix - Summary

## Problem Identified

The Weekly Reflection feature had several functional bugs:

1. **No enforcement of single enabled notebook**: Multiple notebooks could have `include_in_weekly_summary` enabled simultaneously
2. **Incorrect date range calculation**: Used "last 7 days" instead of proper "Monday to Sunday" week boundaries
3. **Poor empty state handling**: Generic messages when no notebook was enabled or no entries existed
4. **Missing visual indicators**: Users couldn't easily identify which notebook was enabled for weekly reflection

## Changes Made

### 1. **Notebooks.tsx** - Enforce Single Enabled Notebook

**Location**: `NotebookModal.handleSubmit` function (lines 318-372)

**What changed**:
- Added logic to disable `include_in_weekly_summary` on ALL other notebooks when enabling it on a new one
- Ensures EXACTLY ONE notebook can be marked for weekly reflection at any time
- Uses a batch query to find and update all previously enabled notebooks

**Code added**:
```typescript
// If enabling weekly summary on this notebook, disable it on all others
if (includeInSummary) {
  const notebooksRef = collection(db, 'notebooks');
  const q = query(
    notebooksRef, 
    where('userId', '==', uid),
    where('include_in_weekly_summary', '==', true)
  );
  const snapshot = await getDocs(q);
  
  // Disable weekly summary on all other notebooks
  const batch = snapshot.docs
    .filter(doc => doc.id !== notebook?.id?.toString())
    .map(doc => updateDoc(doc.ref, { include_in_weekly_summary: false }));
  
  await Promise.all(batch);
}
```

**Location**: Notebook card display (lines 186-203)

**What changed**:
- Added visual badge showing "📊 Weekly" for notebooks with weekly reflection enabled
- Makes it immediately obvious which notebook is being used for weekly summaries

### 2. **WeeklyReflection.tsx** - Fix Data Fetching Logic

**Location**: `fetchInsights` function (lines 30-106)

**What changed**:

#### Better Week Calculation
- Changed from "last 7 days" to proper Monday-Sunday week boundaries
- Handles edge case where today is Sunday (goes back 6 days to find Monday)

```typescript
const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

const startOfWeek = new Date(now);
startOfWeek.setDate(now.getDate() - daysToMonday);
startOfWeek.setHours(0, 0, 0, 0);

const endOfWeek = new Date(startOfWeek);
endOfWeek.setDate(startOfWeek.getDate() + 6);
endOfWeek.setHours(23, 59, 59, 999);
```

#### Improved Query Performance
- Added `where('notebookId', 'in', weeklyNotebookIds)` to query
- Filters entries at database level instead of only client-side
- More efficient, especially as the number of entries grows

#### Better Empty State Messages

**Case 1: No notebook enabled**
```
"No notebook is enabled for weekly reflection. Go to Notebooks and enable 'Include in Weekly Summary' for one notebook."
```

**Case 2: Enabled notebook has no entries this week**
```
"No entries found for this week in your enabled notebook. Start writing to see insights!"
```

**Case 3: Less than 3 entries**
```
"You have X entry/entries this week. Write at least 3 entries to see meaningful insights."
```

## Expected Behavior After Fix

### ✅ Single Enabled Notebook
- Only ONE notebook can have `include_in_weekly_summary === true` at any time
- When enabling weekly summary on a notebook, it automatically disables it on all others
- Visual "📊 Weekly" badge clearly indicates which notebook is enabled

### ✅ Correct Data Fetching
- Weekly Reflection shows entries from Monday (start of week) to Sunday (end of week)
- Only entries from the enabled notebook are included
- Database-level filtering for better performance

### ✅ Clear User Feedback
- If no notebook enabled: Shows actionable message to enable one
- If enabled but no entries: Prompts user to start writing
- If < 3 entries: Shows count and explains need for more entries
- If ≥ 3 entries: Shows weekly insights

### ✅ Real-time Updates
- Changes hot-reload immediately (Vite HMR)
- New entries are reflected when user returns to Weekly Reflection page
- Toggling weekly summary on/off updates instantly

## Testing Checklist

- [ ] Navigate to Notebooks page
- [ ] Enable "Include in Weekly Summary" on Notebook A
- [ ] Verify "📊 Weekly" badge appears on Notebook A
- [ ] Enable "Include in Weekly Summary" on Notebook B
- [ ] Verify badge moves from Notebook A to Notebook B (only one enabled)
- [ ] Navigate to Weekly Reflection
- [ ] If no entries: Verify appropriate message appears
- [ ] Create 1-2 entries in enabled notebook
- [ ] Return to Weekly Reflection: Should show "X entries" message
- [ ] Create 3+ entries in enabled notebook this week
- [ ] Return to Weekly Reflection: Should show insights
- [ ] Create entries in a different (non-enabled) notebook
- [ ] Return to Weekly Reflection: Those entries should NOT appear

## Files Modified

1. `frontend/src/pages/Notebooks.tsx` - Enforce single enabled notebook + visual badge
2. `frontend/src/pages/WeeklyReflection.tsx` - Fix data fetching logic + better empty states

## No Breaking Changes

- ✅ Database schema unchanged
- ✅ Field name remains `include_in_weekly_summary`
- ✅ UI design unchanged (only added informational badge)
- ✅ No new features added
- ✅ Existing notebook functionality preserved
