# Chart Images Directory

This directory stores images that can be displayed on charts in the Report tab.

## Configuration

Images are configured in `chart_images_config.json` in the parent directory. Each image entry should have:

- `species_type`: "bird" or "butterfly" - determines which species charts the image appears on
- `x_axis_position`: X-axis position on the chart (0.0 to 1.0, where 0.7 = 70% across)
- `y_axis_position`: Y-axis position on the chart (0.0 to 1.0, where 0.65 = 65% up)
- `file_path`: Relative path to the image file from the dashboards directory
- `caption`: Text caption to display below the image

## Example Configuration

```json
{
  "chart_images": [
    {
      "species_type": "bird",
      "x_axis_position": 0.7,
      "y_axis_position": 0.65,
      "file_path": "images/turtle_dove.jpg",
      "caption": "Turtle Dove"
    },
    {
      "species_type": "butterfly",
      "x_axis_position": 0.3,
      "y_axis_position": 0.8,
      "file_path": "images/monarch_butterfly.jpg",
      "caption": "Monarch Butterfly"
    }
  ]
}
```

## Image Requirements

- Images are automatically converted to circular thumbnails (150x150px)
- Supported formats: JPG, PNG
- For best results, use square images
- Keep file sizes reasonable for web display