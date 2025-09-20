# Chart Images Directory

This directory stores images that can be displayed on charts in the Report tab.

## Configuration

Images are configured in `chart_images_config.json` in the parent directory. Each image entry should have:

- `species_type`: "bird" or "butterfly" - determines which species charts the image appears on
- `x_axis_position`: X-axis position on the chart (0.0 to 1.0, where 0.7 = 70% across)
- `y_axis_position`: Y-axis position on the chart (0.0 to 1.0, where 0.65 = 65% up)
- `file_path`: Relative path to the image file from the dashboards directory
- `caption`: Text caption to display below the image
- `dotted_line` (optional): Object specifying coordinates for a dotted line connection

## Example Configuration

```json
{
  "chart_images": [
    {
      "species_type": "bird",
      "x_axis_position": 0.86,
      "y_axis_position": 0.77,
      "file_path": "images/turtledove.jpg",
      "caption": "Turtle Dove",
      "dotted_line": {
        "x1": 0.86,
        "y1": 0.77,
        "x2": "2025-06",
        "y2": 74,
        "x1_ref": "paper",
        "y1_ref": "paper",
        "x2_ref": "x",
        "y2_ref": "y",
        "color": "#666666",
        "width": 2,
        "style": "dot",
        "opacity": 0.7
      }
    }
  ]
}
```

## Dotted Lines

The `dotted_line` feature draws a customizable line between any two points:

**Required fields:**
- `x1`, `y1`: Start point coordinates
- `x2`, `y2`: End point coordinates

**Optional fields:**
- `x1_ref`, `y1_ref`: Reference system for start point (default: "paper")
- `x2_ref`, `y2_ref`: Reference system for end point (default: "paper")
- `color`: Line color (default: "#666666")
- `width`: Line width (default: 2)
- `style`: Line style - "solid", "dot", "dash", "longdash", "dashdot", "longdashdot" (default: "dot")
- `opacity`: Line opacity 0-1 (default: 0.7)

**Coordinate systems:**
- `"paper"`: 0.0-1.0 relative to chart area
- `"x"`: Chart's x-axis values (dates, etc.)
- `"y"`: Chart's y-axis values (numbers)

## Image Requirements

- Images are automatically converted to circular thumbnails (150x150px)
- Supported formats: JPG, PNG
- For best results, use square images
- Keep file sizes reasonable for web display