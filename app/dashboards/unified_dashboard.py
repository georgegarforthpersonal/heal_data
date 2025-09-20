import streamlit as st
import pandas as pd
from datetime import datetime, date, timedelta
from typing import List, Literal
import plotly.express as px
import plotly.graph_objects as go
from collections import defaultdict
import sys
import os
import base64
from PIL import Image, ImageDraw, ImageFilter
import io
import json

# Add the parent directory to the path so we can import from app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.connection import get_db_cursor
from database.models import Species, Sighting


# Authentication credentials
AUTH_USERNAME = "heal"
AUTH_PASSWORD = "nightingale"


def check_password():
    """Returns `True` if the user had the correct password."""

    def password_entered():
        """Checks whether a password entered by the user is correct."""
        if (st.session_state["username"] == AUTH_USERNAME and
                st.session_state["password"] == AUTH_PASSWORD):
            st.session_state["password_correct"] = True
            del st.session_state["password"]  # Don't store the password
            del st.session_state["username"]  # Don't store the username
        else:
            st.session_state["password_correct"] = False

    # Return True if the password is validated
    if st.session_state.get("password_correct", False):
        return True

    # Show input for password
    st.markdown("### 🔐 Login Required")
    st.markdown("Please enter your credentials to access the Survey Dashboard.")

    col1, col2, col3 = st.columns([1, 2, 1])

    with col2:
        st.text_input(
            "Username",
            key="username",
            placeholder="Enter username"
        )
        st.text_input(
            "Password",
            type="password",
            key="password",
            placeholder="Enter password"
        )
        st.button("Login", on_click=password_entered)

    if "password_correct" in st.session_state:
        if not st.session_state["password_correct"]:
            st.error("❌ Invalid username or password")

    return False


def load_sightings(species_type: Literal["bird", "butterfly"]) -> List[dict]:
    """
    Load sightings from the database for the specified species type

    Args:
        species_type: Either "bird" or "butterfly"

    Returns:
        List of sighting dictionaries with species and survey data
    """
    sightings = []

    try:
        with get_db_cursor() as cursor:
            # Query to get sightings with species, survey, and surveyor information
            query = """
            SELECT
                s.date,
                sp.name as species_name,
                sp.conservation_status,
                si.count,
                t.name as transect_name,
                STRING_AGG(sur.first_name || ' ' || sur.last_name, ', ') as surveyors,
                s.notes
            FROM sighting si
            JOIN survey s ON si.survey_id = s.id
            JOIN species sp ON si.species_id = sp.id
            LEFT JOIN transect t ON si.transect_id = t.id
            LEFT JOIN survey_surveyor ss ON s.id = ss.survey_id
            LEFT JOIN surveyor sur ON ss.surveyor_id = sur.id
            WHERE s.type = %s
            GROUP BY s.id, s.date, sp.name, sp.conservation_status, si.count, t.name, s.notes
            ORDER BY s.date DESC
            """

            cursor.execute(query, (species_type,))
            rows = cursor.fetchall()

            for row in rows:
                sighting = {
                    'date': row[0],
                    'species_name': row[1],
                    'conservation_status': row[2] or 'Green',  # Default to Green if None
                    'count': row[3],
                    'transect_name': row[4] or 'Unknown',
                    'surveyors': row[5] or 'Unknown',
                    'notes': row[6] or ''
                }
                sightings.append(sighting)

    except Exception as e:
        print(f"Error loading {species_type} sightings from database: {e}")
        return []

    return sightings


def get_sightings(species_type: Literal["bird", "butterfly"]) -> List[dict]:
    return load_sightings(species_type)


def filter_sightings(sightings: List[dict], conservation_statuses=None, date_range=None, locations=None):
    """Filter sightings based on selected criteria."""
    filtered = sightings

    if conservation_statuses and len(conservation_statuses) < 3:  # Only filter if not all are selected
        filtered = [s for s in filtered if s['conservation_status'] in conservation_statuses]

    if date_range and len(date_range) == 2:
        start_date, end_date = date_range
        filtered = [s for s in filtered if start_date <= s['date'] <= end_date]

    if locations:
        filtered = [s for s in filtered if s['transect_name'] in locations]

    return filtered


def create_species_chart(sightings: List[dict]):
    """Create a bar chart of species sightings colored by conservation status."""
    # Calculate species counts
    species_data = defaultdict(lambda: {'count': 0, 'category': ''})

    for sighting in sightings:
        species_data[sighting['species_name']]['count'] += sighting['count']
        species_data[sighting['species_name']]['category'] = sighting['conservation_status']

    # Convert to list and sort by count (descending)
    species_list = [(name, data['count'], data['category'])
                    for name, data in species_data.items()]
    species_list.sort(key=lambda x: x[1], reverse=True)

    # Prepare data for plotting
    species_names = [item[0] for item in species_list]
    counts = [item[1] for item in species_list]
    categories = [item[2] for item in species_list]

    # Color mapping for conservation status
    color_map = {'Green': '#2E7D32', 'Amber': '#F57C00', 'Red': '#C62828'}
    colors = [color_map.get(cat, '#2E7D32') for cat in categories]

    # Create plotly bar chart
    fig = go.Figure(data=[
        go.Bar(
            x=species_names,
            y=counts,
            marker_color=colors,
        )
    ])

    fig.update_layout(
        title="Species Sightings by Conservation Status",
        xaxis_title="Species",
        yaxis_title="Total Count",
        xaxis={'tickangle': 45},
        height=600,
        showlegend=False
    )

    return fig


def create_sighting_timeline(sightings: List[dict], selected_species: List[str], species_type: str):
    """Create a timeline chart showing individual sighting dates for selected species."""
    if not selected_species:
        return None

    # Filter sightings for selected species
    filtered_sightings = [s for s in sightings if s['species_name'] in selected_species]

    if not filtered_sightings:
        return None

    # Group by species and date, summing counts
    timeline_data = defaultdict(lambda: defaultdict(int))
    for sighting in filtered_sightings:
        timeline_data[sighting['species_name']][sighting['date']] += sighting['count']

    # Create DataFrame for plotting
    plot_data = []
    for species_name, dates in timeline_data.items():
        for date_val, total_count in dates.items():
            plot_data.append({
                'Species': species_name,
                'Date': date_val,
                'Count': total_count
            })

    df = pd.DataFrame(plot_data)
    df = df.sort_values('Date')

    # Create bar chart
    fig = px.bar(df, x='Date', y='Count', color='Species',
                 title=f"Sighting Dates Timeline",
                 labels={'Count': f'{species_type.title()}s Counted', 'Date': 'Survey Date'})

    fig.update_layout(height=400, xaxis={'tickangle': 45})

    return fig


def get_date_range_options():
    """Get predefined date range options."""
    today = date.today()
    return {
        "Last 3 months": (today - timedelta(days=90), today),
        "Last 6 months": (today - timedelta(days=180), today),
        "Last year": (today - timedelta(days=365), today),
        "This year": (date(today.year, 1, 1), today),
        "All time": None
    }


def create_quarterly_species_chart(sightings: List[dict]):
    """Create a chart showing unique species count by quarter."""
    if not sightings:
        return None

    # Group sightings by quarter and collect unique species
    quarterly_data = defaultdict(set)

    for sighting in sightings:
        # Get the quarter from the date
        year = sighting['date'].year
        quarter = (sighting['date'].month - 1) // 3 + 1
        quarter_key = f"{year} Q{quarter}"

        # Add species to the set for this quarter (set automatically handles uniqueness)
        quarterly_data[quarter_key].add(sighting['species_name'])

    # Convert to list of tuples for sorting and plotting
    quarterly_counts = [(quarter, len(species_set)) for quarter, species_set in quarterly_data.items()]
    quarterly_counts.sort(key=lambda x: x[0])  # Sort by quarter chronologically

    if not quarterly_counts:
        return None

    quarters = [item[0] for item in quarterly_counts]
    counts = [item[1] for item in quarterly_counts]

    # Create plotly bar chart
    fig = go.Figure(data=[
        go.Bar(
            x=quarters,
            y=counts,
            marker_color='#1f77b4',
            text=counts,
            textposition='auto'
        )
    ])

    fig.update_layout(
        title="Unique Species Count by Quarter",
        xaxis_title="Quarter",
        yaxis_title="Number of Unique Species",
        xaxis={'tickangle': 45},
        height=500,
        showlegend=False
    )

    return fig


def create_monthly_species_chart(sightings: List[dict]):
    """Create a chart showing unique species count by month."""
    if not sightings:
        return None

    # Group sightings by month and collect unique species
    monthly_data = defaultdict(set)

    for sighting in sightings:
        # Get the month/year from the date
        year_month = sighting['date'].strftime('%Y-%m')
        monthly_data[year_month].add(sighting['species_name'])

    # Convert to list of tuples for sorting and plotting
    monthly_counts = [(month, len(species_set)) for month, species_set in monthly_data.items()]
    monthly_counts.sort(key=lambda x: x[0])  # Sort chronologically

    if not monthly_counts:
        return None

    months = [item[0] for item in monthly_counts]
    counts = [item[1] for item in monthly_counts]

    # Create plotly bar chart
    fig = go.Figure(data=[
        go.Bar(
            x=months,
            y=counts,
            marker_color='#2ca02c',
            text=counts,
            textposition='auto'
        )
    ])

    fig.update_layout(
        title="Unique Species Count by Month",
        xaxis_title="Month",
        yaxis_title="Number of Unique Species",
        xaxis={'tickangle': 45},
        height=500,
        showlegend=False
    )

    return fig


def create_yearly_species_chart(sightings: List[dict]):
    """Create a chart showing unique species count by year."""
    if not sightings:
        return None

    # Group sightings by year and collect unique species
    yearly_data = defaultdict(set)

    for sighting in sightings:
        # Get the year from the date
        year = str(sighting['date'].year)
        yearly_data[year].add(sighting['species_name'])

    # Convert to list of tuples for sorting and plotting
    yearly_counts = [(year, len(species_set)) for year, species_set in yearly_data.items()]
    yearly_counts.sort(key=lambda x: x[0])  # Sort chronologically

    if not yearly_counts:
        return None

    years = [item[0] for item in yearly_counts]
    counts = [item[1] for item in yearly_counts]

    # Create plotly bar chart
    fig = go.Figure(data=[
        go.Bar(
            x=years,
            y=counts,
            marker_color='#ff7f0e',
            text=counts,
            textposition='auto'
        )
    ])

    fig.update_layout(
        title="Unique Species Count by Year",
        xaxis_title="Year",
        yaxis_title="Number of Unique Species",
        height=500,
        showlegend=False
    )

    return fig


def create_total_sightings_chart(sightings: List[dict]):
    """Create a chart showing total sightings count by survey date."""
    if not sightings:
        return None

    # Group sightings by date and sum counts
    survey_data = defaultdict(int)

    for sighting in sightings:
        survey_data[sighting['date']] += sighting['count']

    # Convert to list of tuples for sorting and plotting
    survey_counts = [(date, count) for date, count in survey_data.items()]
    survey_counts.sort(key=lambda x: x[0])  # Sort chronologically

    if not survey_counts:
        return None

    dates = [item[0] for item in survey_counts]
    counts = [item[1] for item in survey_counts]

    # Create plotly bar chart
    fig = go.Figure(data=[
        go.Bar(
            x=dates,
            y=counts,
            marker_color='#9467bd',
            text=counts,
            textposition='auto'
        )
    ])

    fig.update_layout(
        title="Total Sightings by Survey Date",
        xaxis_title="Survey Date",
        yaxis_title="Total Sightings Count",
        xaxis={'tickangle': 45},
        height=500,
        showlegend=False
    )

    return fig


def load_chart_images_config():
    """Load chart images configuration from config file"""
    try:
        config_path = os.path.join(os.path.dirname(__file__), 'chart_images_config.json')
        with open(config_path, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Could not load chart images config: {e}")
        return {"chart_images": []}


def create_cumulative_species_chart(sightings: List[dict], timescale: str, species_type: str = "bird"):
    """Create a chart showing cumulative unique species over time."""
    if not sightings:
        return None

    # Group sightings by time period and collect unique species
    time_data = defaultdict(set)

    for sighting in sightings:
        if timescale == "Monthly":
            time_key = sighting['date'].strftime('%Y-%m')
        elif timescale == "Quarterly":
            year = sighting['date'].year
            quarter = (sighting['date'].month - 1) // 3 + 1
            time_key = f"{year} Q{quarter}"
        else:  # Yearly
            time_key = str(sighting['date'].year)

        time_data[time_key].add(sighting['species_name'])

    # Sort periods chronologically
    sorted_periods = sorted(time_data.keys())

    # Calculate cumulative unique species
    cumulative_species = set()
    cumulative_data = []

    for period in sorted_periods:
        cumulative_species.update(time_data[period])
        cumulative_data.append((period, len(cumulative_species)))

    if not cumulative_data:
        return None

    periods = [item[0] for item in cumulative_data]
    cumulative_counts = [item[1] for item in cumulative_data]

    # Create plotly line chart
    fig = go.Figure(data=[
        go.Scatter(
            x=periods,
            y=cumulative_counts,
            mode='lines+markers',
            line=dict(color='#17becf', width=3),
            marker=dict(size=8),
            text=cumulative_counts,
            textposition='top center'
        )
    ])

    # Add images based on configuration
    config = load_chart_images_config()
    for image_config in config.get('chart_images', []):
        if image_config.get('species_type') == species_type:
            try:
                # Get the path to the image
                image_path = os.path.join(os.path.dirname(__file__), image_config['file_path'])

                # Create circular cropped image with PIL
                def create_circular_image(image_path, size=150):
                    # Open and resize image
                    img = Image.open(image_path).convert("RGBA")
                    img = img.resize((size, size), Image.Resampling.LANCZOS)

                    # Create circular mask
                    mask = Image.new('L', (size, size), 0)
                    draw = ImageDraw.Draw(mask)
                    draw.ellipse((0, 0, size, size), fill=255)

                    # Apply mask to image
                    output = Image.new('RGBA', (size, size), (0, 0, 0, 0))
                    output.paste(img, (0, 0))
                    output.putalpha(mask)

                    return output

                # Create circular image
                circular_img = create_circular_image(image_path, 150)

                # Convert to base64
                buffer = io.BytesIO()
                circular_img.save(buffer, format="PNG")
                img_base64 = base64.b64encode(buffer.getvalue()).decode()

                # Add the circular image using paper coordinates
                fig.add_layout_image(
                    dict(
                        source=f"data:image/png;base64,{img_base64}",
                        xref="paper",
                        yref="paper",
                        x=image_config['x_axis_position'],
                        y=image_config['y_axis_position'],
                        sizex=0.2,  # 20% of chart width
                        sizey=0.2,  # 20% of chart height
                        xanchor="center",
                        yanchor="middle",
                        opacity=1.0,
                        layer="below"
                    )
                )

                # Add caption text below the image
                fig.add_annotation(
                    x=image_config['x_axis_position'],
                    y=image_config['y_axis_position'] - 0.08,  # Closer to the image
                    text=image_config['caption'],
                    showarrow=False,
                    font=dict(size=12, color="#333333"),
                    xref="paper",
                    yref="paper",
                    xanchor="center",
                    yanchor="top"
                )

                # Add dotted line between two points if specified
                if 'dotted_line' in image_config:
                    line_config = image_config['dotted_line']

                    # Get coordinates for both points
                    x1 = line_config.get('x1')
                    y1 = line_config.get('y1')
                    x2 = line_config.get('x2')
                    y2 = line_config.get('y2')

                    # Get coordinate system references (default to paper)
                    x1_ref = line_config.get('x1_ref', 'paper')
                    y1_ref = line_config.get('y1_ref', 'paper')
                    x2_ref = line_config.get('x2_ref', 'paper')
                    y2_ref = line_config.get('y2_ref', 'paper')

                    if all(coord is not None for coord in [x1, y1, x2, y2]):
                        # Add dotted line as a shape
                        fig.add_shape(
                            type="line",
                            x0=x1, y0=y1,
                            x1=x2, y1=y2,
                            xref=x1_ref, yref=y1_ref,
                            line=dict(
                                color=line_config.get('color', '#666666'),
                                width=line_config.get('width', 2),
                                dash=line_config.get('style', 'dot')
                            ),
                            opacity=line_config.get('opacity', 0.7)
                        )

            except Exception as e:
                # If image loading fails, continue without the image
                print(f"Could not load image {image_config.get('file_path', 'unknown')}: {e}")
                st.error(f"Could not load image {image_config.get('file_path', 'unknown')}: {e}")

    fig.update_layout(
        title=f"Cumulative Unique Species Over Time ({timescale})",
        xaxis_title="Period",
        yaxis_title="Cumulative Unique Species Count",
        xaxis={'tickangle': 45, 'showgrid': False},
        yaxis={'showgrid': False},
        height=500,
        showlegend=False,
        plot_bgcolor='rgba(0,0,0,0)',  # Transparent plot background
        paper_bgcolor='rgba(0,0,0,0)'  # Transparent paper background
    )

    return fig


def render_dashboard(species: Literal["bird", "butterfly"]):
    """Render the dashboard content (without authentication and page config)"""
    # Load the sightings data
    with st.spinner(f"Loading {species} sightings data..."):
        try:
            sightings = get_sightings(species)

            if sightings:
                # Get unique values for filters
                all_locations = sorted(list(set(s['transect_name'] for s in sightings)))
                date_range_options = get_date_range_options()

                # Only show conservation filter if there are meaningful conservation statuses
                actual_conservation_statuses = set(s['conservation_status'] for s in sightings)
                # Remove 'Green' if it's the only status (likely all defaults)
                meaningful_statuses = actual_conservation_statuses - {'Green'}
                has_conservation_data = bool(meaningful_statuses) or len(actual_conservation_statuses) > 1
                all_conservation_statuses = ["Green", "Amber", "Red"] if has_conservation_data else []

                # Create tabs for different views
                tab1, tab2, tab3, tab4, tab5 = st.tabs(["📊 Overview", "🔍 Species Detail", "📊 Total Species", "📈 Total Sightings", "📋 Raw Data"])

                with tab1:
                    st.header("Survey Overview")

                    # Filters - adjust layout based on whether conservation status filter is shown
                    if has_conservation_data:
                        col1, col2, col3 = st.columns(3)
                        with col1:
                            selected_conservation = st.multiselect("Conservation Status:", all_conservation_statuses,
                                                                   default=all_conservation_statuses,
                                                                   key=f"{species}_conservation")
                        with col2:
                            selected_date_range_key = st.selectbox("Date Range:", list(date_range_options.keys()),
                                                                  index=0,  # Default to "Last 3 months"
                                                                  key=f"{species}_date_range")
                        with col3:
                            selected_locations = st.multiselect("Locations:", all_locations, default=all_locations,
                                                               key=f"{species}_locations")
                    else:
                        # No conservation filter, use 2 columns
                        col1, col2 = st.columns(2)
                        selected_conservation = None
                        with col1:
                            selected_date_range_key = st.selectbox("Date Range:", list(date_range_options.keys()),
                                                                  index=0,  # Default to "Last 3 months"
                                                                  key=f"{species}_date_range")
                        with col2:
                            selected_locations = st.multiselect("Locations:", all_locations, default=all_locations,
                                                               key=f"{species}_locations")

                    selected_date_range = date_range_options[selected_date_range_key]

                    # Apply filters
                    filtered_sightings = filter_sightings(
                        sightings,
                        selected_conservation,
                        selected_date_range,
                        selected_locations
                    )

                    # Display species count
                    unique_species = len(set(s['species_name'] for s in filtered_sightings))
                    st.metric("Species Observed", f"{unique_species} species")

                    # Species chart
                    if filtered_sightings:
                        fig = create_species_chart(filtered_sightings)
                        st.plotly_chart(fig, use_container_width=True)
                    else:
                        st.warning("No data available for the selected filters.")

                with tab2:
                    st.header("Species Details & Timeline")

                    # Species selector (multi-select) with species-specific defaults
                    all_species = sorted(list(set(s['species_name'] for s in sightings)))

                    # Set default species based on type
                    if species == "butterfly":
                        default_species = ["Meadow Brown"] if "Meadow Brown" in all_species else []
                    else:  # bird
                        default_species = ["Blackbird"] if "Blackbird" in all_species else []

                    selected_species = st.multiselect("Select species:", all_species,
                                                      default=default_species,
                                                      key=f"{species}_species_select")

                    if selected_species:
                        # Create summary table for selected species
                        species_summary_data = []
                        for species_name in selected_species:
                            species_sightings = [s for s in sightings if s['species_name'] == species_name]

                            if species_sightings:
                                row_data = {
                                    "Species": species_name,
                                    "Total Sightings": sum(s['count'] for s in species_sightings)
                                }
                                # Only add conservation status if there's meaningful data
                                if has_conservation_data:
                                    row_data["Conservation Status"] = species_sightings[0]['conservation_status']
                                species_summary_data.append(row_data)

                        # Display summary table
                        if species_summary_data:
                            summary_df = pd.DataFrame(species_summary_data)
                            st.dataframe(summary_df, use_container_width=True, hide_index=True)

                        # Sighting dates timeline chart
                        timeline_fig = create_sighting_timeline(sightings, selected_species, species)
                        if timeline_fig:
                            st.plotly_chart(timeline_fig, use_container_width=True)
                        else:
                            st.info("No sightings data available for the selected species.")

                with tab3:
                    st.header("Total Species")

                    # Controls for time trends
                    col1, col2 = st.columns(2)
                    with col1:
                        timescale = st.selectbox(
                            "Select Time Scale:",
                            ["Monthly", "Quarterly", "Yearly"],
                            key=f"{species}_timescale"
                        )

                    with col2:
                        # Conservation status filter
                        if has_conservation_data:
                            selected_conservation_trends = st.multiselect(
                                "Conservation Status:",
                                all_conservation_statuses,
                                default=all_conservation_statuses,
                                key=f"{species}_conservation_trends"
                            )
                        else:
                            selected_conservation_trends = None

                    # Filter sightings by conservation status
                    trend_sightings = sightings
                    if selected_conservation_trends and has_conservation_data:
                        trend_sightings = [s for s in sightings if s['conservation_status'] in selected_conservation_trends]

                    if trend_sightings:
                        # Generate appropriate chart based on timescale
                        if timescale == "Monthly":
                            fig = create_monthly_species_chart(trend_sightings)
                            time_data = defaultdict(set)
                            for sighting in trend_sightings:
                                year_month = sighting['date'].strftime('%Y-%m')
                                time_data[year_month].add(sighting['species_name'])
                            period_name = "Month"
                        elif timescale == "Quarterly":
                            fig = create_quarterly_species_chart(trend_sightings)
                            time_data = defaultdict(set)
                            for sighting in trend_sightings:
                                year = sighting['date'].year
                                quarter = (sighting['date'].month - 1) // 3 + 1
                                quarter_key = f"{year} Q{quarter}"
                                time_data[quarter_key].add(sighting['species_name'])
                            period_name = "Quarter"
                        else:  # Yearly
                            fig = create_yearly_species_chart(trend_sightings)
                            time_data = defaultdict(set)
                            for sighting in trend_sightings:
                                year = str(sighting['date'].year)
                                time_data[year].add(sighting['species_name'])
                            period_name = "Year"

                        if fig:
                            st.plotly_chart(fig, use_container_width=True)

                            # Create and display cumulative species chart (without image)
                            cumulative_fig = create_cumulative_species_chart(trend_sightings, timescale, species_type="none")
                            if cumulative_fig:
                                st.plotly_chart(cumulative_fig, use_container_width=True)

                            # Show breakdown table
                            st.subheader(f"{timescale} Breakdown")

                            # Create table data with new species tracking and cumulative count
                            table_data = []
                            seen_species = set()
                            for period, species_set in sorted(time_data.items()):
                                new_species = species_set - seen_species
                                seen_species.update(species_set)
                                table_data.append({
                                    period_name: period,
                                    "Unique Species": len(species_set),
                                    "Cumulative Species": len(seen_species),
                                    "New Species": ", ".join(sorted(new_species)) if new_species else "None",
                                    "Species List": ", ".join(sorted(species_set)[:5]) + ("..." if len(species_set) > 5 else "")
                                })

                            if table_data:
                                trends_df = pd.DataFrame(table_data)
                                st.dataframe(trends_df, use_container_width=True, hide_index=True)
                        else:
                            st.info(f"No data available to show {timescale.lower()} trends.")
                    else:
                        st.info("No data available for the selected conservation status filters.")

                with tab4:
                    st.header("Total Sightings")

                    # Conservation status filter for total sightings
                    if has_conservation_data:
                        selected_conservation_sightings = st.multiselect(
                            "Conservation Status:",
                            all_conservation_statuses,
                            default=all_conservation_statuses,
                            key=f"{species}_conservation_sightings"
                        )
                    else:
                        selected_conservation_sightings = None

                    # Filter sightings by conservation status
                    sightings_filtered = sightings
                    if selected_conservation_sightings and has_conservation_data:
                        sightings_filtered = [s for s in sightings if s['conservation_status'] in selected_conservation_sightings]

                    if sightings_filtered:
                        # Create total sightings chart
                        fig = create_total_sightings_chart(sightings_filtered)
                        if fig:
                            st.plotly_chart(fig, use_container_width=True)

                            # Show summary statistics
                            total_surveys = len(set(s['date'] for s in sightings_filtered))
                            total_sightings = sum(s['count'] for s in sightings_filtered)
                            avg_sightings = total_sightings / total_surveys if total_surveys > 0 else 0

                            col1, col2, col3 = st.columns(3)
                            with col1:
                                st.metric("Total Surveys", total_surveys)
                            with col2:
                                st.metric("Total Sightings", total_sightings)
                            with col3:
                                st.metric("Avg Sightings/Survey", f"{avg_sightings:.1f}")

                        else:
                            st.info("No data available to show total sightings.")
                    else:
                        st.info("No data available for the selected conservation status filters.")

                with tab5:
                    st.header("Raw Sightings Data")

                    # Convert to DataFrame for display
                    df_data = []
                    for sighting in sightings:
                        row_data = {
                            "Date": sighting['date'],
                            "Species": sighting['species_name'],
                            "Count": sighting['count'],
                            "Location": sighting['transect_name'],
                            "Surveyors": sighting['surveyors']
                        }
                        # Only add conservation status if there's meaningful data
                        if has_conservation_data:
                            row_data["Conservation Status"] = sighting['conservation_status']
                        df_data.append(row_data)

                    df = pd.DataFrame(df_data)
                    st.dataframe(df, use_container_width=True)

                    # Download button
                    csv = df.to_csv(index=False)
                    st.download_button(
                        label="Download as CSV",
                        data=csv,
                        file_name=f"heal_somerset_{species}_sightings.csv",
                        mime="text/csv"
                    )

            else:
                st.error("❌ No sightings could be loaded from the database.")
                st.info(f"Please check that you have {species} survey data in the database.")

        except Exception as e:
            st.error(f"❌ Error loading data: {str(e)}")
            st.info("Please check the database connection and try again.")


def render_report(species: Literal["bird", "butterfly"]):
    """Render the report chart for the specified species"""
    # Load the sightings data
    with st.spinner(f"Loading {species} sightings data..."):
        try:
            sightings = get_sightings(species)

            if sightings:
                # Create cumulative species chart with configured images
                cumulative_fig = create_cumulative_species_chart(sightings, "Monthly", species_type=species)
                if cumulative_fig:
                    st.plotly_chart(cumulative_fig, use_container_width=True)
                else:
                    st.info(f"No data available to show the {species} report chart.")
            else:
                st.error(f"❌ No {species} sightings could be loaded from the database.")
                st.info(f"Please check that you have {species} survey data in the database.")

        except Exception as e:
            st.error(f"❌ Error loading {species} data: {str(e)}")
            st.info("Please check the database connection and try again.")


def main(species: Literal["bird", "butterfly"]):
    """Main function to render the dashboard with authentication"""
    # Set page config based on species
    icons = {"bird": "🦉", "butterfly": "🦋"}

    st.set_page_config(
        page_title=f"Heal Somerset {species.title()} Survey",
        page_icon=icons[species],
        layout="wide"
    )

    # Check if the user is authenticated
    if not check_password():
        st.stop()  # Stop execution if not authenticated

    st.title(f"{icons[species]} Heal Somerset {species.title()} Survey Dashboard")
    st.markdown(f"Welcome to the {species} sightings analysis dashboard for Heal Somerset.")

    # Create top-level navigation tabs
    main_tab1, main_tab2, main_tab3 = st.tabs(["📊 Surveys", "📈 Dashboard", "📋 Report"])

    with main_tab1:
        st.info("Surveys functionality - to be implemented")

    with main_tab2:
        render_dashboard(species)

    with main_tab3:
        render_report(species)