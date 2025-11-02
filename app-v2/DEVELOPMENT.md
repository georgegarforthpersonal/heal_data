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
