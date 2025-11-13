# Development Guide - Wildlife Survey Management V2

This document describes the development approach, conventions, and patterns for building this React application.

## Our Development Philosophy

**Start simple, extract when needed** - Build features inline first, then extract components when you see duplication. This prevents over-engineering and lets patterns emerge naturally.

## Project Structure

```
app-v2/frontend/src/
├── components/
│   ├── common/          # Reusable UI components (buttons, inputs, etc.)
│   ├── features/        # Domain-specific components (SurveyCard, etc.)
├── pages/               # Full page views (SurveysPage, DashboardPage, etc.)
├── App.tsx              # Main app component
├── theme.ts             # MUI theme configuration
└── main.tsx             # Entry point
```

## Component Strategy

### When to Create Components

**Don't create components upfront** - Wait for these signals:

1. **Duplication** - Same code appears 2-3+ times (Rule of 3)
2. **Logical boundaries** - Clear, self-contained functionality
3. **Complexity** - Section is complex enough to benefit from isolation

### Component Extraction Pattern

**Step 1: Build inline** (everything in the page file)
```tsx
// pages/SurveysPage.tsx
export function SurveysPage() {
  return (
    <Box>
      <Paper>...survey card code...</Paper>
      <Paper>...survey card code...</Paper>  // Duplication!
      <Paper>...survey card code...</Paper>
    </Box>
  )
}
```

**Step 2: Notice duplication** - See the same JSX repeated

**Step 3: Extract to component** (move to separate file)
```tsx
// components/features/SurveyCard.tsx
export function SurveyCard({ title, location, date }) {
  return <Paper>...survey card code...</Paper>
}

// pages/SurveysPage.tsx
export function SurveysPage() {
  return (
    <Box>
      {surveys.map(survey => <SurveyCard {...survey} />)}
    </Box>
  )
}
```

### Where Components Go

- **`components/common/`** - Generic UI elements used everywhere
  - Only create if MUI doesn't provide it
  - Examples: custom buttons, form wrappers, layout components

- **`components/features/`** - Domain-specific, reusable components
  - Examples: SurveyCard, SpeciesSelector, ChartWidget
  - Extracted from pages when duplication appears

- **`pages/`** - Full page views
  - Start building everything here
  - Extract components later

## Theme & Styling

### MUI (Material-UI)

We use MUI for all UI components. It provides:
- Pre-built, styled components (Button, Table, Paper, etc.)
- Automatic theme integration
- Responsive design out of the box

```tsx
// All MUI components automatically use theme.ts
import { Button, Typography, Paper } from '@mui/material';

<Button color="primary">  // Uses theme.palette.primary.main
<Paper>                    // Uses theme shadows and borders
```

### Theme Customization

Edit `src/theme.ts` to change:
- Colors (primary, secondary, backgrounds)
- Typography (fonts, sizes, weights)
- Spacing and borders
- Component defaults

**All MUI components update automatically** when you change the theme.

### Styling Guidelines

1. **Use MUI components first** - Don't reinvent the wheel
2. **Use `sx` prop for custom styles** - Inline styling with theme access
3. **Keep it simple** - Avoid complex custom CSS until needed

```tsx
// ✅ Good: Using MUI + sx prop
<Box sx={{ p: 3, bgcolor: 'background.paper' }}>
  <Typography variant="h1">Title</Typography>
</Box>

// ❌ Avoid: Custom CSS unless necessary
<div className="custom-box">
  <h1 className="custom-title">Title</h1>
</div>
```

## Data Flow Pattern

### Mock Data → API

Start with mock data, replace with API later:

```tsx
export function SurveysPage() {
  // Mock data - will come from API later
  const surveys = [
    { id: 1, title: 'Survey 1', ... },
    { id: 2, title: 'Survey 2', ... },
  ];

  // Later: Replace with API call
  // const { data: surveys } = useSurveys();

  return <Table>...</Table>
}
```

This lets you build UI independently of backend.

## Role-Based Access Control (RBAC) Patterns

### Overview

Our application has two primary user types:
1. **Read-Only Users (Majority)** - Can view all surveys and sightings
2. **Admin Users** - Can create, edit, and delete surveys and sightings

### Design Decision: Actions on Detail Page Only

**Decision Made:** Edit and Delete actions are ONLY shown on the detail page, NOT in the surveys table.

**Rationale:**
- Primary user action is **viewing** surveys (all users)
- Edit/Delete are **secondary** actions (admins only)
- Removing action buttons from table benefits read-only users:
  - Cleaner visual design (no unused columns)
  - More space for data columns (significant on tablets)
  - No permission confusion
- Admin users accept one extra click to edit (view → edit)
- Viewing before editing makes sense for complex surveys (20+ sightings)

### UI Pattern Guidelines

#### ✅ Best Practices: Hide, Don't Disable

```tsx
// ✅ Good: Hide buttons from users without permissions
{hasPermission('edit_survey') && (
  <Button onClick={handleEdit}>Edit Survey</Button>
)}

// ❌ Bad: Show disabled buttons to all users
<Button disabled={!hasPermission('edit_survey')}>Edit Survey</Button>
```

**Why?** Disabled buttons create confusion and waste screen space. If users can't perform an action, remove it from the UI entirely.

#### Hide vs. Disable vs. Error: Decision Tree

When a user lacks permission for an action, choose the right pattern:

##### **1. HIDE the button** ✅ (Most Common for RBAC)

**When to use:**
- User will **never** have access due to their role
- Permanent permission restriction (not temporary state)
- Examples: "New Survey" button, "Edit" button, "Delete" button

**Why:**
- Reduces cognitive load (users don't waste mental effort on unavailable actions)
- Cleaner interface for majority of users
- No visual clutter from unused features

```tsx
// ✅ Good: Hide "New Survey" button from read-only users
const canCreate = hasPermission('create_survey');

{canCreate && (
  <Button onClick={handleNewSurvey}>New</Button>
)}
```

**Research quote:**
> "If the user is not authorized to use the control (therefore, it will never become available to that person) it should be hidden."

---

##### **2. DISABLE the button** ⚠️ (Rare for RBAC)

**When to use:**
- Feature **might** become available in current session
- User can take action to enable it (fill form, change selection, etc.)
- Examples: "Save" disabled until form is valid, "Submit" disabled until required fields filled

**Why:**
- Shows feature exists but isn't available right now
- Indicates something needs to change first
- Must include tooltip explaining why and how to enable

```tsx
// ⚠️ Disable when user CAN enable it (not for permissions!)
<Tooltip title="Fill all required fields to enable">
  <span> {/* Wrapper needed for disabled button tooltip */}
    <Button disabled={!isFormValid}>Save</Button>
  </span>
</Tooltip>
```

**When NOT to use for RBAC:**
- ❌ Don't disable "New Survey" for read-only users (they can't change their role)
- ❌ Don't disable "Edit" for users without permission (wastes their mental effort)

**Exception:** If users can **request** permission elevation through the app:
```tsx
// Only if request workflow exists
<Tooltip title="Request admin access to create surveys">
  <span>
    <Button
      disabled={!canCreate}
      onClick={canCreate ? handleCreate : handleRequestAccess}
    >
      New Survey
    </Button>
  </span>
</Tooltip>
```

---

##### **3. SHOW ERROR MESSAGE** ❌ (Worst Option)

**When to use:**
- Can't determine if action will fail until trying
- Examples: Network errors, server-side validations, unpredictable failures

**Why this is bad for permissions:**
- Forces users to "fail" to learn they don't have access
- Creates frustration (click → rejection → confusion)
- Only use when failure is unpredictable

```tsx
// ❌ Bad: Let user click, then show error
<Button onClick={() => {
  if (!hasPermission('create_survey')) {
    showError("You don't have permission to create surveys");
    return;
  }
  handleCreate();
}}>
  New Survey
</Button>
```

---

##### **Quick Reference Table**

| Pattern | Use When | Example | RBAC? |
|---------|----------|---------|-------|
| **Hide** | Permanent restriction, will never be available | "New" button for read-only users | ✅ Yes |
| **Disable** | Temporary restriction, might become available | "Save" until form valid | ❌ No |
| **Error** | Can't predict failure until trying | Network operations | ❌ No |

##### **Rule of Thumb**

- **Hide** if user's role determines access (permissions)
- **Disable** if user's actions determine access (form state, selections)
- **Error** if system state determines access (network, server)

#### Permission-Based Rendering Locations

**SurveysPage (Table View):**
- ✅ **"New" button** (admin only) - Top right, hidden from read-only users
- ❌ **No action buttons** in table
- ✅ **All rows clickable** for navigation (all users)
- Read-only users see clean table with no create/edit actions
- Admin users see "New" button and same clean table

**SurveyDetailPage:**
- ✅ **Edit button** (admin only) - Top right in view mode
- ✅ **Delete button** (admin only) - Top right in view mode
- ✅ **Save/Cancel buttons** - Top right in edit mode (only in edit mode)
- ✅ **Add sighting button** (admin only) - In sightings section
- ✅ **Edit/Delete per sighting** (admin only) - In sightings table

### Implementation Pattern (Future)

When implementing RBAC, follow this pattern:

#### 1. Create Auth Context

```tsx
// src/context/AuthContext.tsx
interface AuthContextType {
  user: User | null;
  hasPermission: (permission: string) => boolean;
  isAdmin: boolean;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
```

#### 2. Define Permissions

```tsx
// Common permissions
const PERMISSIONS = {
  VIEW_SURVEYS: 'view_surveys',       // All users
  EDIT_SURVEY: 'edit_survey',         // Admin only
  DELETE_SURVEY: 'delete_survey',     // Admin only
  CREATE_SURVEY: 'create_survey',     // Admin only
  EDIT_SIGHTING: 'edit_sighting',     // Admin only
  DELETE_SIGHTING: 'delete_sighting', // Admin only
};
```

#### 3. Apply to Components

**In SurveyDetailPage:**
```tsx
export function SurveyDetailPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('edit_survey');
  const canDelete = hasPermission('delete_survey');

  return (
    <>
      {/* Only show edit button to users with permission */}
      {canEdit && (
        <Button onClick={handleEdit}>Edit Survey</Button>
      )}

      {/* Only show delete button to users with permission */}
      {canDelete && (
        <Button onClick={handleDelete}>Delete Survey</Button>
      )}
    </>
  );
}
```

**In New Survey Button:**
```tsx
export function SurveysPage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('create_survey');

  return (
    <>
      {canCreate && (
        <Button onClick={handleNewSurvey}>New Survey</Button>
      )}
    </>
  );
}
```

#### 4. Backend Enforcement (Critical!)

⚠️ **Security Note:** Frontend permission checks are for UX only. Always enforce permissions on the backend/API level.

```python
# Backend example (FastAPI)
@router.delete("/surveys/{survey_id}")
async def delete_survey(
    survey_id: int,
    current_user: User = Depends(get_current_user)
):
    if not current_user.has_permission("delete_survey"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    # Proceed with deletion
    ...
```

### User Flows

**Read-Only User (Most Common):**
1. See surveys table (clean, no action buttons)
2. Click row → view survey details
3. See all information (read-only)
4. No edit/delete buttons visible

**Admin User - Edit:**
1. See surveys table (same as read-only)
2. Click row → view survey details
3. See Edit and Delete buttons
4. Click Edit → make changes
5. Click Save

**Admin User - Delete:**
1. See surveys table
2. Click row → view survey details
3. Click Delete button
4. Confirm in dialog
5. Navigate back to list

### Migration Checklist

When implementing RBAC:

- [ ] Create `AuthContext` and `AuthProvider`
- [ ] Define permission constants
- [ ] Implement `hasPermission()` function
- [ ] Update `SurveyDetailPage` with permission checks
- [ ] Update "New Survey" button with permission check
- [ ] Update sightings actions with permission checks
- [ ] Remove TODO comments from code
- [ ] Test with different user roles
- [ ] Ensure backend API enforces permissions

### Testing RBAC

Test matrix for each user type:

| Feature | Read-Only | Admin |
|---------|-----------|-------|
| View surveys list | ✅ | ✅ |
| See "New" button | ❌ | ✅ |
| Create new survey | ❌ | ✅ |
| Click survey row | ✅ | ✅ |
| View survey details | ✅ | ✅ |
| See Edit button | ❌ | ✅ |
| See Delete button | ❌ | ✅ |
| Edit survey | ❌ | ✅ |
| Delete survey | ❌ | ✅ |
| See "Add Sighting" button | ❌ | ✅ |
| Add sighting | ❌ | ✅ |
| Edit sighting | ❌ | ✅ |
| Delete sighting | ❌ | ✅ |

### Reference Research

These patterns are based on industry best practices:
- **"Hide, don't disable"** - Remove restricted actions from UI rather than showing disabled buttons
- **"Design for primary use case"** - Optimize for read-only users (majority)
- **"Permission-based rendering"** - Show different UI based on user roles
- **"Backend enforcement"** - Always validate permissions server-side

## Development Workflow

### For Building New Features

1. **Identify the feature** - What page/view are you building?
2. **Create in `pages/`** - Build everything inline first
3. **Use mock data** - Don't wait for API
4. **Use MUI components** - Table, Paper, Typography, etc.
5. **See duplication?** - Extract to `components/features/`
6. **Test in browser** - `npm run dev` and check localhost:5173
7. **Commit when working** - Small, frequent commits

### Example: Adding a New Dashboard Page

```tsx
// 1. Create pages/DashboardPage.tsx
export function DashboardPage() {
  // Mock data
  const stats = { butterflies: 247, birds: 189 };

  // Build inline - no components yet
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h1">Dashboard</Typography>

      <Paper sx={{ p: 3 }}>
        <Typography>Butterflies: {stats.butterflies}</Typography>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography>Birds: {stats.birds}</Typography>
      </Paper>
    </Box>
  )
}

// 2. Notice duplication? Extract StatCard component later
```

## Git Workflow

### Commit Guidelines

- **Small, focused commits** - One feature/change per commit
- **Descriptive messages** - Explain what and why
- **Commit working code** - Test before committing

### Branch Strategy

- `magpie2` - Current development branch
- Merge to main when features are complete

## AI-Assisted Development Tips

### Clear Prompts for Components

✅ **Good prompts:**
- "Create a surveys page with a table view"
- "Extract the survey card into a reusable component"
- "Add a filter dropdown to the surveys table"

❌ **Vague prompts:**
- "Make it better"
- "Add more features"
- "Create all the components we'll need"

### Provide Context

When asking for changes, reference:
- File paths (e.g., "in pages/SurveysPage.tsx")
- Existing patterns (e.g., "like the SurveyCard component")
- Specific requirements (e.g., "table with 6 columns")

### Incremental Changes

Build in small steps:
1. Create page with mock data
2. Add basic layout
3. Add table/list view
4. Extract components if needed
5. Add interactivity (filters, sorting)
6. Connect to API

## Tech Stack Reference

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool (fast dev server)
- **MUI (Material-UI)** - Component library
- **Docker** - Containerization

## Common MUI Components

```tsx
// Layout
<Box>           // Generic container (like div)
<Container>     // Centered, max-width container
<Stack>         // Vertical/horizontal stack with spacing
<Paper>         // Card-like surface with shadow

// Typography
<Typography variant="h1">  // Headings
<Typography variant="body1">  // Body text

// Data Display
<Table>         // Tables with headers and rows
<Chip>          // Small labeled pills/tags
<Avatar>        // Profile pictures/icons

// Inputs
<Button>        // Buttons (primary, outlined, text)
<TextField>     // Text inputs
<Select>        // Dropdowns

// Feedback
<Alert>         // Success/error/info messages
<CircularProgress>  // Loading spinner
```

## Next Steps (Future Features)

When ready to expand:

1. **Routing** - React Router for multiple pages
2. **State Management** - React Query or Zustand
3. **API Integration** - Connect to FastAPI backend
4. **Forms** - react-hook-form for survey creation
5. **Charts** - Chart.js or Recharts for visualizations
6. **Authentication** - Port from Streamlit v1

## Questions or Issues?

- Check MUI docs: https://mui.com/
- Review this guide for patterns
- Build simple first, add complexity later
- When in doubt, extract components after duplication appears
