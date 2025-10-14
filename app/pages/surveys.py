import streamlit as st
import psycopg2
from datetime import date, time
from typing import List, Optional, Tuple

from database.connection import get_db_cursor
from database.models import Survey, Sighting
from survey_config import get_survey_fields, get_field_config

def render_survey_field(field_name: str, survey_type: str, surveyors: List[Tuple[int, str]] = None):
    """Render a single survey field based on its configuration."""
    config = get_field_config(survey_type, field_name)
    field_type = config.get("type", "text")
    label = config.get("label", field_name.title())
    help_text = config.get("help", "")
    
    if field_name == "date":
        return st.date_input(label, value=date.today(), help=help_text, key=f"new_survey_{survey_type}_date")
    
    elif field_name == "surveyors":
        if surveyors:
            surveyor_options = {f"{name}": surveyor_id for surveyor_id, name in surveyors}
            surveyor_options["No surveyor"] = None
            return st.multiselect(label, options=list(surveyor_options.keys()), help=help_text, key=f"new_survey_{survey_type}_surveyors"), surveyor_options
        return [], {}
    
    elif field_name == "start_time":
        default_time = time(9, 0)  # Default 9:00 AM
        return st.time_input(label, value=default_time, help=help_text, key=f"new_survey_{survey_type}_start_time")
    
    elif field_name == "end_time":
        default_time = time(10, 0)  # Default 10:00 AM
        return st.time_input(label, value=default_time, help=help_text, key=f"new_survey_{survey_type}_end_time")
    
    elif field_name == "sun_percentage":
        return st.slider(
            label, 
            min_value=config.get("min", 0),
            max_value=config.get("max", 100),
            value=config.get("default", 50),
            help=help_text,
            key=f"new_survey_{survey_type}_sun_percentage"
        )
    
    elif field_name == "temperature":
        return st.number_input(
            label,
            min_value=config.get("min", -50.0),
            max_value=config.get("max", 60.0),
            value=config.get("default", 20.0),
            step=config.get("step", 0.1),
            help=help_text,
            key=f"new_survey_{survey_type}_temperature"
        )
    
    elif field_name == "conditions_met":
        return st.checkbox(
            label,
            value=config.get("default", False),
            help=help_text,
            key=f"new_survey_{survey_type}_conditions_met"
        )
    
    elif field_name == "notes":
        return st.text_area(
            label,
            help=help_text,
            placeholder=config.get("placeholder", ""),
            key=f"new_survey_{survey_type}_notes"
        )
    
    else:
        return st.text_input(label, help=help_text, key=f"new_survey_{survey_type}_{field_name}")

def render_survey_field_for_edit(field_name: str, survey_type: str, survey_obj, surveyors: List[Tuple[int, str]] = None):
    """Render a survey field for editing with current values."""
    config = get_field_config(survey_type, field_name)
    help_text = config.get("help", "")
    
    if field_name == "date":
        return st.date_input("Date", value=survey_obj.date or date.today(), help=help_text, label_visibility="collapsed", key=f"edit_survey_{survey_type}_{survey_obj.id}_date")
    
    elif field_name == "surveyors":
        if surveyors:
            surveyor_options = {f"{name}": surveyor_id for surveyor_id, name in surveyors}
            surveyor_options["No surveyor"] = None
            
            current_surveyors = []
            for name, surveyor_id in surveyor_options.items():
                if surveyor_id in (survey_obj.surveyor_ids or []):
                    current_surveyors.append(name)
            
            selected = st.multiselect("Surveyors", options=list(surveyor_options.keys()), 
                                    default=current_surveyors, help=help_text,
                                    label_visibility="collapsed", key=f"edit_survey_{survey_type}_{survey_obj.id}_surveyors")
            return selected, surveyor_options
        return [], {}
    
    elif field_name == "start_time":
        return st.time_input("Start", value=survey_obj.start_time or time(9, 0), help=help_text, label_visibility="collapsed", key=f"edit_survey_{survey_type}_{survey_obj.id}_start_time")
    
    elif field_name == "end_time":
        return st.time_input("End", value=survey_obj.end_time or time(10, 0), help=help_text, label_visibility="collapsed", key=f"edit_survey_{survey_type}_{survey_obj.id}_end_time")
    
    elif field_name == "sun_percentage":
        return st.number_input("Sun%", 0, 100, survey_obj.sun_percentage or 50, help=help_text, label_visibility="collapsed", key=f"edit_survey_{survey_type}_{survey_obj.id}_sun_percentage")
    
    elif field_name == "temperature":
        temp_value = float(survey_obj.temperature_celsius) if survey_obj.temperature_celsius else 20.0
        return st.number_input("Temp", -50.0, 60.0, temp_value, 0.1, help=help_text, label_visibility="collapsed", key=f"edit_survey_{survey_type}_{survey_obj.id}_temperature")
    
    elif field_name == "conditions_met":
        return st.checkbox("✓", value=survey_obj.conditions_met or False, help=help_text, label_visibility="collapsed", key=f"edit_survey_{survey_type}_{survey_obj.id}_conditions_met")
    
    elif field_name == "notes":
        notes_value = survey_obj.notes if survey_obj.notes is not None else ""
        return st.text_area("Notes", value=notes_value, help=help_text, label_visibility="collapsed", key=f"edit_survey_{survey_type}_{survey_obj.id}_notes")
    
    else:
        return st.text_input(field_name.title(), help=help_text, label_visibility="collapsed", key=f"edit_survey_{survey_type}_{survey_obj.id}_{field_name}")

def get_survey_field_display_value(field_name: str, survey):
    """Get display value for a survey field."""
    if field_name == "date":
        return survey[1].strftime("%b %d, %Y")
    elif field_name == "surveyors":
        return survey[10] if survey[10] != 'No surveyor' else 'Unknown'
    elif field_name == "start_time":
        start_time = survey[2].strftime('%H:%M') if survey[2] else "N/A"
        end_time = survey[3].strftime('%H:%M') if survey[3] else "N/A"
        return f"{start_time}-{end_time}"
    elif field_name == "temperature":
        return f"{float(survey[5]):.1f}°C" if survey[5] is not None else "N/A"
    elif field_name == "sun_percentage":
        return f"{survey[4]}%" if survey[4] is not None else "N/A"
    elif field_name == "conditions_met":
        return "✅" if survey[6] else "❌"
    elif field_name == "notes":
        # Notes are now at index 8 in the survey tuple (after adding notes to the query)
        notes = survey[8] if len(survey) > 8 and survey[8] is not None else ""
        return notes if notes else "No notes"
    else:
        return "N/A"

@st.cache_data(ttl=600)  # Cache for 10 minutes
def get_all_surveyors() -> List[Tuple[int, str]]:
    """Get all surveyors for dropdown selection"""
    print("🟢 [CACHE MISS] Fetching all surveyors from database...")
    max_retries = 2
    for attempt in range(max_retries):
        try:
            with get_db_cursor() as cursor:
                cursor.execute("""
                    SELECT id,
                    CASE
                        WHEN last_name IS NULL OR trim(last_name) = ''
                        THEN trim(first_name)
                        ELSE trim(first_name) || ' ' || trim(last_name)
                    END as full_name
                    FROM surveyor
                    ORDER BY first_name, last_name
                """)
                return cursor.fetchall()
        except Exception as e:
            if attempt < max_retries - 1:
                print(f"⚠️ Retry {attempt + 1}/{max_retries}: Error fetching surveyors: {e}")
                continue
            st.error(f"Error fetching surveyors: {e}")
            return []
    return []

@st.cache_data  # Cache indefinitely, manually invalidate on changes
def get_all_surveys() -> List[Tuple]:
    """Get all surveys with surveyor names"""
    try:
        print("🔵 [CACHE MISS] Fetching all surveys from database...")
        with get_db_cursor() as cursor:
            cursor.execute("""
                SELECT s.id, s.date, s.start_time, s.end_time, s.sun_percentage,
                       s.temperature_celsius, s.conditions_met, s.type, s.notes,
                       STRING_AGG(DISTINCT ss.surveyor_id::text, ',') as surveyor_ids,
                       COALESCE(
                           STRING_AGG(DISTINCT
                               CASE
                                   WHEN sv.last_name IS NULL OR trim(sv.last_name) = ''
                                   THEN trim(sv.first_name)
                                   ELSE trim(sv.first_name) || ' ' || trim(sv.last_name)
                               END,
                               ', '
                           ),
                           'No surveyor'
                       ) as surveyor_name
                FROM survey s
                LEFT JOIN survey_surveyor ss ON s.id = ss.survey_id
                LEFT JOIN surveyor sv ON ss.surveyor_id = sv.id
                GROUP BY s.id, s.date, s.start_time, s.end_time, s.sun_percentage, s.temperature_celsius, s.conditions_met, s.type, s.notes
                ORDER BY s.date DESC, s.start_time DESC
            """)
            result = cursor.fetchall()
            print(f"✅ Fetched {len(result)} surveys")
            return result
    except Exception as e:
        st.error(f"Error fetching surveys: {e}")
        return []

def format_survey_display_text(survey: Tuple, sightings_count: int) -> str:
    """Format survey for sidebar display"""
    date_str = survey[1].strftime("%b %d, %Y")
    surveyor_name = survey[10]  # Updated index after adding notes field
    survey_type = survey[7].title()  # type field
    
    return f"{date_str} • {surveyor_name} ({survey_type})"

def create_survey(survey: Survey) -> Optional[int]:
    """Create a new survey and return its ID"""
    try:
        with get_db_cursor() as cursor:
            # Insert survey first
            cursor.execute("""
                INSERT INTO survey (date, start_time, end_time, sun_percentage, temperature_celsius, conditions_met, type, notes)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                survey.date,
                survey.start_time,
                survey.end_time,
                survey.sun_percentage,
                survey.temperature_celsius,
                survey.conditions_met,
                survey.type,
                survey.notes
            ))
            result = cursor.fetchone()
            survey_id = result[0] if result else None

            # Insert surveyor associations if provided
            if survey_id and survey.surveyor_ids:
                for surveyor_id in survey.surveyor_ids:
                    if surveyor_id:  # Skip None values
                        cursor.execute("""
                            INSERT INTO survey_surveyor (survey_id, surveyor_id)
                            VALUES (%s, %s)
                            ON CONFLICT (survey_id, surveyor_id) DO NOTHING
                        """, (survey_id, surveyor_id))

            # Clear cache after creating survey
            get_all_surveys.clear()

            return survey_id
    except Exception as e:
        st.error(f"Error creating survey: {e}")
        return None

def update_survey(survey: Survey) -> bool:
    """Update an existing survey"""
    try:
        with get_db_cursor() as cursor:
            # Update survey data
            cursor.execute("""
                UPDATE survey
                SET date = %s, start_time = %s, end_time = %s, sun_percentage = %s,
                    temperature_celsius = %s, conditions_met = %s, type = %s, notes = %s
                WHERE id = %s
            """, (
                survey.date,
                survey.start_time,
                survey.end_time,
                survey.sun_percentage,
                survey.temperature_celsius,
                survey.conditions_met,
                survey.type,
                survey.notes,
                survey.id
            ))

            # Update surveyor associations
            # First, remove existing associations
            cursor.execute("DELETE FROM survey_surveyor WHERE survey_id = %s", (survey.id,))

            # Then add new associations if provided
            if survey.surveyor_ids:
                for surveyor_id in survey.surveyor_ids:
                    if surveyor_id:  # Skip None values
                        cursor.execute("""
                            INSERT INTO survey_surveyor (survey_id, surveyor_id)
                            VALUES (%s, %s)
                            ON CONFLICT (survey_id, surveyor_id) DO NOTHING
                        """, (survey.id, surveyor_id))

            # Clear cache after updating survey
            get_all_surveys.clear()

            return True
    except Exception as e:
        st.error(f"Error updating survey: {e}")
        return False

def delete_survey(survey_id: int) -> bool:
    """Delete a survey"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute("DELETE FROM survey WHERE id = %s", (survey_id,))

            # Clear cache after deleting survey
            get_all_surveys.clear()

            return True
    except Exception as e:
        st.error(f"Error deleting survey: {e}")
        return False

def get_survey_by_id(survey_id: int) -> Optional[Survey]:
    """Get a specific survey by ID"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute("""
                SELECT s.id, s.date, s.start_time, s.end_time, s.sun_percentage, s.temperature_celsius, s.conditions_met, s.type, s.notes,
                       ARRAY_AGG(ss.surveyor_id) FILTER (WHERE ss.surveyor_id IS NOT NULL) as surveyor_ids
                FROM survey s
                LEFT JOIN survey_surveyor ss ON s.id = ss.survey_id
                WHERE s.id = %s
                GROUP BY s.id, s.date, s.start_time, s.end_time, s.sun_percentage, s.temperature_celsius, s.conditions_met, s.type, s.notes
            """, (survey_id,))
            row = cursor.fetchone()
            if row:
                return Survey(
                    id=row[0],
                    date=row[1],
                    start_time=row[2],
                    end_time=row[3],
                    sun_percentage=row[4],
                    temperature_celsius=row[5],
                    conditions_met=row[6],
                    type=row[7],
                    notes=row[8],
                    surveyor_ids=row[9] if row[9] and row[9][0] is not None else []
                )
            return None
    except Exception as e:
        st.error(f"Error fetching survey: {e}")
        return None

@st.cache_data(ttl=600)  # Cache for 10 minutes
def get_all_species(survey_type: str = None) -> List[Tuple[int, str]]:
    """Get all species for dropdown selection, optionally filtered by type"""
    try:
        with get_db_cursor() as cursor:
            if survey_type:
                cursor.execute("SELECT id, name FROM species WHERE type = %s ORDER BY name", (survey_type,))
            else:
                cursor.execute("SELECT id, name FROM species ORDER BY name")
            return cursor.fetchall()
    except Exception as e:
        st.error(f"Error fetching species: {e}")
        return []

@st.cache_data(ttl=600)  # Cache for 10 minutes
def get_all_transects(survey_type: str = None) -> List[Tuple[int, str, int]]:
    """Get all transects for dropdown selection, optionally filtered by type"""
    try:
        with get_db_cursor() as cursor:
            if survey_type:
                cursor.execute("SELECT id, name, number FROM transect WHERE type = %s ORDER BY number", (survey_type,))
            else:
                cursor.execute("SELECT id, name, number FROM transect ORDER BY number")
            return cursor.fetchall()
    except Exception as e:
        st.error(f"Error fetching transects: {e}")
        return []

@st.cache_data  # Cache sightings counts, manually invalidate on changes
def get_sightings_counts_for_surveys(survey_ids: Tuple[int]) -> dict:
    """Get sightings counts for multiple surveys in a single query"""
    try:
        if not survey_ids:
            return {}
        print(f"🟡 [CACHE MISS] Fetching sightings counts for {len(survey_ids)} surveys...")
        with get_db_cursor() as cursor:
            cursor.execute("""
                SELECT survey_id, COUNT(*) as sighting_count
                FROM sighting
                WHERE survey_id = ANY(%s)
                GROUP BY survey_id
            """, (list(survey_ids),))
            result = cursor.fetchall()
            counts_dict = {row[0]: row[1] for row in result}
            print(f"✅ Fetched sightings counts for {len(counts_dict)} surveys")
            return counts_dict
    except Exception as e:
        st.error(f"Error fetching sightings counts: {e}")
        return {}

@st.cache_data  # Cache sightings, manually invalidate on changes
def get_sightings_for_survey(survey_id: int) -> List[Tuple]:
    """Get all sightings for a specific survey"""
    try:
        print(f"🟡 [CACHE MISS] Fetching sightings for survey {survey_id}...")
        with get_db_cursor() as cursor:
            cursor.execute("""
                SELECT si.id, si.survey_id, si.species_id, si.transect_id, si.count,
                       sp.name as species_name,
                       t.number as transect_number, t.name as transect_name
                FROM sighting si
                JOIN species sp ON si.species_id = sp.id
                JOIN transect t ON si.transect_id = t.id
                WHERE si.survey_id = %s
                ORDER BY t.number, sp.name
            """, (survey_id,))
            result = cursor.fetchall()
            print(f"✅ Fetched {len(result)} sightings for survey {survey_id}")
            return result
    except Exception as e:
        st.error(f"Error fetching sightings: {e}")
        return []

def create_sighting(sighting: Sighting) -> bool:
    """Create a new sighting"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute("""
                INSERT INTO sighting (survey_id, species_id, transect_id, count)
                VALUES (%s, %s, %s, %s)
            """, (
                sighting.survey_id,
                sighting.species_id,
                sighting.transect_id,
                sighting.count
            ))

            # Clear sightings caches
            get_sightings_for_survey.clear()
            get_sightings_counts_for_surveys.clear()

            return True
    except Exception as e:
        st.error(f"Error creating sighting: {e}")
        return False

def update_sighting(sighting: Sighting) -> bool:
    """Update an existing sighting"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute("""
                UPDATE sighting
                SET species_id = %s, transect_id = %s, count = %s
                WHERE id = %s
            """, (
                sighting.species_id,
                sighting.transect_id,
                sighting.count,
                sighting.id
            ))

            # Clear sightings caches
            get_sightings_for_survey.clear()
            get_sightings_counts_for_surveys.clear()

            return True
    except Exception as e:
        st.error(f"Error updating sighting: {e}")
        return False

def delete_sighting(sighting_id: int) -> bool:
    """Delete a sighting"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute("DELETE FROM sighting WHERE id = %s", (sighting_id,))

            # Clear sightings caches
            get_sightings_for_survey.clear()
            get_sightings_counts_for_surveys.clear()

            return True
    except Exception as e:
        st.error(f"Error deleting sighting: {e}")
        return False

def get_sighting_by_id(sighting_id: int) -> Optional[Sighting]:
    """Get a specific sighting by ID"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute("""
                SELECT id, survey_id, species_id, transect_id, count
                FROM sighting WHERE id = %s
            """, (sighting_id,))
            row = cursor.fetchone()
            if row:
                return Sighting(
                    id=row[0],
                    survey_id=row[1],
                    species_id=row[2],
                    transect_id=row[3],
                    count=row[4]
                )
            return None
    except Exception as e:
        st.error(f"Error fetching sighting: {e}")
        return None

def render_tab_content(survey_type):
    """Render the survey interface content for a specific survey type"""

    print(f"🔴 [RENDER] render_tab_content() called for {survey_type}")

    # Get all surveys filtered by type
    all_surveys = get_all_surveys()
    surveys = [survey for survey in all_surveys if survey[7].lower() == survey_type.lower()]

    # Filter/Search bar at the top
    col1, col2 = st.columns([1,1])
    with col1:
        surveyors = get_all_surveyors()
        surveyor_filter_options = [name for _, name in surveyors]
        surveyor_filter = st.selectbox("Filter by Surveyor", ["All"] + surveyor_filter_options, key=f"surveyor_filter_{survey_type}")

    with col2:
        date_options = ["All time", "Last 3 months", "Last month", "Last week"]
        date_filter = st.selectbox("Date Range", date_options, index=2, key=f"date_filter_{survey_type}")

    # Filter surveys based on filters
    filtered_surveys = []
    if surveys:
        for survey in surveys:
            if surveyor_filter != "All":
                surveyor_names = [name.strip().lower() for name in survey[10].split(",")]
                if surveyor_filter.lower() not in surveyor_names:
                    continue

            # Date filter (basic implementation)
            if date_filter != "All time":
                from datetime import timedelta
                cutoff_date = date.today()
                if date_filter == "Last week":
                    cutoff_date -= timedelta(days=7)
                elif date_filter == "Last month":
                    cutoff_date -= timedelta(days=30)
                elif date_filter == "Last 3 months":
                    cutoff_date -= timedelta(days=90)

                if survey[1] < cutoff_date:
                    continue

            filtered_surveys.append(survey)

    st.write("")  # Spacing

    # Initialize a counter for new surveys if it doesn't exist
    counter_key = f"new_survey_counter_{survey_type}"
    if counter_key not in st.session_state:
        st.session_state[counter_key] = 0

    # Create New Survey as first item in the list - using edit survey interface
    # Use a unique ID based on the counter to ensure form fields don't retain old values
    create_survey_id = f"new_survey_{survey_type}_{st.session_state[counter_key]}"

    # Create a fake survey tuple for the new survey (using edit interface)
    default_date = date.today()

    # Create a mock survey tuple that matches the expected format for render_survey_content
    # (id, date, start_time, end_time, sun_percentage, temperature_celsius, conditions_met, type, notes, created_at, surveyor_names)
    new_survey_mock = (
        create_survey_id,  # id
        default_date,      # date
        None,              # start_time
        None,              # end_time
        None,              # sun_percentage
        None,              # temperature_celsius
        None,              # conditions_met
        survey_type,       # type
        None,              # notes
        None,              # created_at
        'No surveyor'      # surveyor_names
    )

    # Check if any form fields exist for this new survey (indicates user has started filling it out)
    # This will keep the expander open while they're working on it
    form_keys_exist = any(
        f"edit_survey_{survey_type}_{create_survey_id}_{field}" in st.session_state
        for field in ["date", "surveyors", "start_time", "end_time", "temperature", "notes"]
    )

    # Keep expander open if user has started filling out the form
    keep_expanded = form_keys_exist

    # Create New Survey expander
    with st.expander(f"➕ Create New {survey_type.title()} Survey", expanded=keep_expanded):
        # Check for success message
        success_key = f"survey_success_{create_survey_id}"
        if st.session_state.get(success_key, False):
            st.success("✅ **Survey created successfully!**")
            # Clear the success flag so it doesn't show again
            del st.session_state[success_key]

        # Use the same render function as edit surveys, but treat it as always in edit mode
        render_survey_content(new_survey_mock)

    # Display success message if survey was just created
    success_flag_key = f"survey_created_success_{survey_type}"
    if st.session_state.get(success_flag_key, False):
        st.success(f"✅ {survey_type.title()} survey created successfully!")
        # Clear the flag so message doesn't persist
        del st.session_state[success_flag_key]

    # Historical Surveys - Each as an expander
    if filtered_surveys:
        # Fetch sightings counts for all surveys in a single query
        survey_ids = tuple([survey[0] for survey in filtered_surveys])
        sightings_counts = get_sightings_counts_for_surveys(survey_ids)

        for survey in filtered_surveys:
            sightings_count = sightings_counts.get(survey[0], 0)

            # Format the expander title
            date_str = survey[1].strftime("%b %d, %Y")
            surveyor_name = survey[10] if survey[10] != 'No surveyor' else 'Unknown'

            expander_title = f"{date_str} • {surveyor_name} • {sightings_count} sightings"

            with st.expander(expander_title):
                # Survey details and editing within the expander
                render_survey_content(survey)
    else:
        if surveyor_filter != "All" or date_filter != "All time":
            st.info(f"No {survey_type} surveys match your current filters.")
        else:
            st.info(f"No {survey_type} surveys found. Create your first {survey_type} survey using the expander above!")

def render_survey_content(survey):
    """Render the content for a single survey within its expander"""
    print(f"🟣 [RENDER] render_survey_content() called for survey {survey[0]}")
    survey_type = survey[7].lower()  # Get survey type from the survey data
    survey_fields = get_survey_fields(survey_type)

    # Check if this is a mock survey (new survey creation)
    is_mock_survey = str(survey[0]).startswith("new_survey_")

    # Success message will be shown at bottom of container

    # Check if editing
    is_editing = st.session_state.get("editing_survey_id") == survey[0]

    # For new surveys (mock surveys), always show as editing
    if is_mock_survey:
        is_editing = True


    
    # Display survey in dynamic table format based on survey type
    col_widths = [2] * len(survey_fields)  # Equal width columns

    # Header row with dynamic fields
    header_cols = st.columns(col_widths)
    for i, field_name in enumerate(survey_fields):
        config = get_field_config(survey_type, field_name)
        label = config.get("label", field_name.title())
        with header_cols[i]:
            st.write(f"**{label}**")

    # Survey data row with dynamic fields
    data_cols = st.columns(col_widths)

    if is_editing:
        # Edit mode - show editable fields
        if is_mock_survey:
            # For mock surveys (new survey creation), create a mock survey object
            # Use survey[0] as the id to ensure keys match when reading back
            survey_obj = Survey(
                id=survey[0],
                date=survey[1],
                start_time=survey[2],
                end_time=survey[3],
                sun_percentage=survey[4],
                temperature_celsius=survey[5],
                conditions_met=survey[6],
                type=survey[7],
                notes=survey[8],
                surveyor_ids=[]
            )
        else:
            survey_obj = get_survey_by_id(survey[0])

        if survey_obj:
            surveyors = get_all_surveyors()

            for i, field_name in enumerate(survey_fields):
                with data_cols[i]:
                    if field_name == "surveyors":
                        render_survey_field_for_edit(field_name, survey_type, survey_obj, surveyors)
                    else:
                        render_survey_field_for_edit(field_name, survey_type, survey_obj, surveyors)
    else:
        # Display mode - show read-only values
        for i, field_name in enumerate(survey_fields):
            with data_cols[i]:
                display_value = get_survey_field_display_value(field_name, survey)
                if field_name == "notes":
                    # Use text area for better multi-line display of notes
                    st.text_area("", value=display_value, disabled=True, height=100, label_visibility="collapsed", key=f"notes_display_{survey[0]}")
                else:
                    st.write(display_value)

    st.divider()
    
    # Sightings section
    sightings = [] if is_mock_survey else get_sightings_for_survey(survey[0])
    
    # Sightings will be displayed below
    
    # Display sightings in compact table format
    # Get pending additions
    pending_additions_key = f"pending_sighting_additions_{survey[0]}"
    pending_additions = st.session_state.get(pending_additions_key, [])

    # Display table if we have existing sightings or pending additions
    if sightings or pending_additions:
        # Table header
        header_col1, header_col2, header_col3, header_col4 = st.columns([3, 2, 1, 2])
        with header_col1:
            st.write("**Species**")
        with header_col2:
            st.write("**Location**")
        with header_col3:
            st.write("**Count**")
        with header_col4:
            st.write("**Actions**")

        # Initialize pending deletions set if not exists
        pending_deletions_key = f"pending_sighting_deletions_{survey[0]}"
        if pending_deletions_key not in st.session_state:
            st.session_state[pending_deletions_key] = set()

        # Display existing sightings
        for sighting in sightings:
            # Check if this sighting is marked for deletion
            is_marked_for_deletion = sighting[0] in st.session_state[pending_deletions_key]

            # Apply styling for deleted sightings
            if is_marked_for_deletion:
                st.markdown("""
                <style>
                .deleted-sighting {
                    background-color: #ffebee;
                    padding: 5px;
                    border-radius: 5px;
                }
                </style>
                """, unsafe_allow_html=True)

            col1, col2, col3, col4 = st.columns([3, 2, 1, 2])

            if is_editing:
                # Edit mode - show editable fields for sightings
                with col1:
                    if is_marked_for_deletion:
                        st.markdown(f'<div class="deleted-sighting">{sighting[5]}</div>', unsafe_allow_html=True)
                    else:
                        species_list = get_all_species(survey[7])  # survey[7] is the survey type
                        species_options = {name: species_id for species_id, name in species_list}
                        current_species = ""
                        for name, species_id in species_options.items():
                            if species_id == sighting[2]:
                                current_species = name
                                break

                        st.selectbox("Species", options=list(species_options.keys()),
                                   index=list(species_options.keys()).index(current_species),
                                   key=f"edit_species_{sighting[0]}", label_visibility="collapsed")

                with col2:
                    if is_marked_for_deletion:
                        st.markdown(f'<div class="deleted-sighting">{sighting[6]} - {sighting[7]}</div>', unsafe_allow_html=True)
                    else:
                        transects = get_all_transects(survey[7])  # survey[7] is the survey type
                        transect_options = {f"{number} - {name}": transect_id for transect_id, name, number in transects}
                        current_transect = ""
                        for transect_desc, transect_id in transect_options.items():
                            if transect_id == sighting[3]:
                                current_transect = transect_desc
                                break

                        st.selectbox("Transect", options=list(transect_options.keys()),
                                   index=list(transect_options.keys()).index(current_transect),
                                   key=f"edit_transect_{sighting[0]}", label_visibility="collapsed")

                with col3:
                    if is_marked_for_deletion:
                        st.markdown(f'<div class="deleted-sighting">{sighting[4]}</div>', unsafe_allow_html=True)
                    else:
                        st.number_input("Count", min_value=1, value=sighting[4],
                                      key=f"edit_count_{sighting[0]}", label_visibility="collapsed")

                with col4:
                    if is_marked_for_deletion:
                        # Show "undo delete" button if marked for deletion
                        def undo_delete(sighting_id=sighting[0]):
                            st.session_state[pending_deletions_key].remove(sighting_id)

                        st.button("↩️", key=f"undo_delete_sighting_{sighting[0]}", help="Undo Delete", on_click=undo_delete)
                    else:
                        # Show delete button if not marked for deletion
                        def mark_for_delete(sighting_id=sighting[0]):
                            st.session_state[pending_deletions_key].add(sighting_id)

                        st.button("🗑️", key=f"delete_sighting_{sighting[0]}", help="Delete Sighting", on_click=mark_for_delete)
            else:
                # Display mode - show read-only values
                with col1:
                    st.write(sighting[5])  # species_name
                with col2:
                    st.write(f"{sighting[6]} - {sighting[7]}")  # transect_number - transect_name
                with col3:
                    st.write(f"**{sighting[4]}**")  # count
                with col4:
                    st.write("")  # Empty space where edit buttons would be

        # Display all pending new sightings in a single container
        if pending_additions:
            with st.container(border=True):
                # st.caption("🆕 Pending Additions")

                for i, pending_sighting in enumerate(pending_additions):
                    col1, col2, col3, col4 = st.columns([3, 2, 1, 2])

                    if is_editing:
                        # Edit mode - show editable fields for pending sightings
                        with col1:
                            species_list = get_all_species(survey[7])
                            species_options = [name for species_id, name in species_list]
                            try:
                                species_index = species_options.index(pending_sighting["species_name"]) if pending_sighting["species_name"] else None
                            except (ValueError, TypeError):
                                species_index = None  # No default selection

                            selected_species = st.selectbox("Species", options=species_options,
                                       index=species_index,
                                       placeholder="Select Species...",
                                       key=f"edit_pending_species_{pending_sighting['temp_id']}",
                                       label_visibility="collapsed")

                            # Update the pending sighting data with the selected species
                            if selected_species and pending_sighting["species_name"] != selected_species:
                                pending_sighting["species_name"] = selected_species
                                st.session_state[pending_additions_key][i] = pending_sighting

                        with col2:
                            transects = get_all_transects(survey[7])
                            transect_options = [f"{number} - {name}" for transect_id, name, number in transects]
                            try:
                                transect_index = transect_options.index(pending_sighting["transect_display"]) if pending_sighting["transect_display"] else None
                            except (ValueError, TypeError):
                                transect_index = None  # No default selection

                            selected_transect = st.selectbox("Transect", options=transect_options,
                                       index=transect_index,
                                       placeholder="Select Location...",
                                       key=f"edit_pending_transect_{pending_sighting['temp_id']}",
                                       label_visibility="collapsed")

                            # Update the pending sighting data with the selected transect
                            if selected_transect and pending_sighting["transect_display"] != selected_transect:
                                pending_sighting["transect_display"] = selected_transect
                                st.session_state[pending_additions_key][i] = pending_sighting

                        with col3:
                            st.number_input("Count", min_value=1, value=pending_sighting["count"],
                                          key=f"edit_pending_count_{pending_sighting['temp_id']}",
                                          label_visibility="collapsed")

                        with col4:
                            def remove_pending(index=i):
                                st.session_state[pending_additions_key].pop(index)

                            st.button("🗑️", key=f"remove_pending_sighting_{pending_sighting['temp_id']}", help="Delete Sighting", on_click=remove_pending)
                    else:
                        # Display mode - show read-only values
                        with col1:
                            st.write(pending_sighting["species_name"] or "No species selected")
                        with col2:
                            st.write(pending_sighting["transect_display"] or "No transect selected")
                        with col3:
                            st.write(f"**{pending_sighting['count']}**")
                        with col4:
                            st.write("")  # Empty space

    else:
        st.info("No sightings recorded yet. Click 'Add New Sighting' to get started.")

    # Add sighting button (only show in edit mode) - moved below sightings
    if is_editing:
        if st.button("➕ Add New Sighting", key=f"add_sighting_btn_{survey[0]}"):
            # Immediately add a blank pending sighting to the list
            pending_additions_key = f"pending_sighting_additions_{survey[0]}"
            if pending_additions_key not in st.session_state:
                st.session_state[pending_additions_key] = []

            # Generate a temporary ID for the pending sighting using timestamp to ensure uniqueness
            import time
            temp_id = f"temp_{int(time.time() * 1000)}_{len(st.session_state[pending_additions_key])}"

            # Determine default location from most recent sighting
            default_transect_id = None
            default_transect_display = None

            # Check if there are existing sightings or pending additions to inherit location from
            if sightings:
                # Use the last sighting's location
                last_sighting = sightings[-1]
                default_transect_id = last_sighting[3]  # transect_id
                default_transect_display = f"{last_sighting[6]} - {last_sighting[7]}"  # "number - name"
            elif pending_additions:
                # Use the last pending addition's location
                last_pending = pending_additions[-1]
                default_transect_id = last_pending["transect_id"]
                default_transect_display = last_pending["transect_display"]

            # Add a blank sighting with inherited location or None values
            new_sighting_data = {
                "temp_id": temp_id,
                "survey_id": survey[0],
                "species_id": None,
                "transect_id": default_transect_id,
                "count": 1,
                "species_name": None,
                "transect_display": default_transect_display
            }

            st.session_state[pending_additions_key].append(new_sighting_data)
            st.rerun()  # Explicitly trigger rerun to show the new sighting immediately

    # Edit Survey / Save/Discard buttons
    st.divider()

    if not is_editing:
        # Show Edit Survey button when not in edit mode
        col1, col2, col3 = st.columns([1, 1, 1])
        with col1:
            if st.button("✏️ Edit Survey", type="primary", use_container_width=True, key=f"edit_survey_btn_{survey[0]}"):
                st.session_state.editing_survey_id = survey[0]
                st.rerun()
    else:
        # Show Save/Discard buttons when in edit mode
        col1, col2, col3 = st.columns([1, 1, 1])

        with col1:
            # Check if this is a new survey creation or existing survey update
            is_new_survey = str(survey[0]).startswith("new_survey_")

            if st.button("💾 Save Survey", type="primary", use_container_width=True, key=f"save_changes_btn_{survey[0]}"):
                if is_new_survey:
                    # Handle new survey creation
                    survey_type = survey[7].lower()
                    surveyors = get_all_surveyors()
                    survey_obj = None  # No existing survey object for new surveys
                else:
                    # Get current survey object for existing survey
                    survey_obj = get_survey_by_id(survey[0])

                if is_new_survey or survey_obj:
                    # Collect all survey field values from session state
                    surveyors = get_all_surveyors()

                    # Build form data from current widget states
                    form_data = {}
                    # Always use survey[0] for key generation since that's what was used when creating the form fields
                    survey_id_for_key = survey[0]

                    for field_name in survey_fields:
                        # Use the same key format as render_survey_field_for_edit
                        key = f"edit_survey_{survey_type}_{survey_id_for_key}_{field_name}"

                        if field_name == "surveyors":
                            # Special handling for surveyors - read directly from session state
                            if key in st.session_state:
                                selected_surveyors = st.session_state[key]
                                form_data[field_name] = selected_surveyors
                                # Rebuild surveyor options
                                surveyor_options = {f"{name}": surveyor_id for surveyor_id, name in surveyors}
                                surveyor_options["No surveyor"] = None
                                form_data["_surveyor_options"] = surveyor_options
                        else:
                            if key in st.session_state:
                                form_data[field_name] = st.session_state[key]

                    # Validate and save survey
                    success = True
                    time_error = False

                    # Validate time fields if both exist
                    if "start_time" in form_data and "end_time" in form_data:
                        if form_data["start_time"] and form_data["end_time"] and form_data["start_time"] >= form_data["end_time"]:
                            st.error("Start time must be before end time.")
                            time_error = True
                            success = False

                    if not time_error:
                        # Process surveyor selection
                        surveyor_ids = []
                        if not is_new_survey and survey_obj:
                            surveyor_ids = survey_obj.surveyor_ids or []

                        if "surveyors" in form_data and "_surveyor_options" in form_data:
                            selected_surveyors = form_data["surveyors"]
                            surveyor_options = form_data["_surveyor_options"]
                            surveyor_ids = [surveyor_options[name] for name in selected_surveyors if surveyor_options[name] is not None]

                        if is_new_survey:
                            # Create new survey object
                            from decimal import Decimal
                            new_survey = Survey(
                                id=None,
                                date=form_data.get("date", survey[1]),
                                start_time=form_data.get("start_time"),
                                end_time=form_data.get("end_time"),
                                sun_percentage=form_data.get("sun_percentage"),
                                temperature_celsius=Decimal(str(form_data["temperature"])) if "temperature" in form_data else None,
                                conditions_met=form_data.get("conditions_met"),
                                notes=form_data.get("notes"),
                                type=survey_type,
                                surveyor_ids=surveyor_ids
                            )
                            # Create survey in database
                            created_survey_id = create_survey(new_survey)
                            operation_success = created_survey_id is not None
                            actual_survey_id = created_survey_id
                        else:
                            # Create updated survey object
                            from decimal import Decimal
                            updated_survey = Survey(
                                id=survey_obj.id,
                                date=form_data.get("date", survey_obj.date),
                                start_time=form_data.get("start_time", survey_obj.start_time),
                                end_time=form_data.get("end_time", survey_obj.end_time),
                                sun_percentage=form_data.get("sun_percentage", survey_obj.sun_percentage),
                                temperature_celsius=Decimal(str(form_data["temperature"])) if "temperature" in form_data else survey_obj.temperature_celsius,
                                conditions_met=form_data.get("conditions_met", survey_obj.conditions_met),
                                notes=form_data.get("notes", survey_obj.notes),
                                type=survey_type,
                                surveyor_ids=surveyor_ids
                            )
                            # Update existing survey
                            operation_success = update_survey(updated_survey)
                            actual_survey_id = survey[0]

                        # If survey creation/update was successful
                        if operation_success:
                            # First handle pending deletions (only for existing surveys)
                            pending_deletions_key = f"pending_sighting_deletions_{survey[0]}"
                            pending_deletions = st.session_state.get(pending_deletions_key, set()) if not is_new_survey else set()

                            for sighting_id in pending_deletions:
                                if not delete_sighting(sighting_id):
                                    st.error("Failed to delete some sightings")
                                    success = False
                                    break

                            # Handle pending additions
                            if success:
                                pending_additions_key = f"pending_sighting_additions_{survey[0]}"
                                pending_additions = st.session_state.get(pending_additions_key, [])

                                for pending_sighting in pending_additions:
                                    # Get current values from session state widgets
                                    species_key = f"edit_pending_species_{pending_sighting['temp_id']}"
                                    transect_key = f"edit_pending_transect_{pending_sighting['temp_id']}"
                                    count_key = f"edit_pending_count_{pending_sighting['temp_id']}"

                                    if all(key in st.session_state for key in [species_key, transect_key, count_key]):
                                        # Get updated values from widgets
                                        selected_species = st.session_state[species_key]
                                        selected_transect = st.session_state[transect_key]

                                        # Validate that valid selections were made
                                        if selected_species is None or selected_transect is None:
                                            st.error("Please select valid species and transect for all new sightings.")
                                            success = False
                                            break

                                        species_list = get_all_species(survey[7])
                                        species_options = {name: species_id for species_id, name in species_list}

                                        transects = get_all_transects(survey[7])
                                        transect_options = {f"{number} - {name}": transect_id for transect_id, name, number in transects}

                                        new_sighting = Sighting(
                                            survey_id=actual_survey_id,
                                            species_id=species_options[selected_species],
                                            transect_id=transect_options[selected_transect],
                                            count=st.session_state[count_key]
                                        )
                                    else:
                                        # Use original values if widgets haven't been created yet
                                        new_sighting = Sighting(
                                            survey_id=actual_survey_id,
                                            species_id=pending_sighting["species_id"],
                                            transect_id=pending_sighting["transect_id"],
                                            count=pending_sighting["count"]
                                        )

                                    if not create_sighting(new_sighting):
                                        st.error("Failed to create some new sightings")
                                        success = False
                                        break

                            # Save sighting changes for non-deleted existing sightings
                            if success:
                                for sighting in sightings:
                                    # Skip sightings marked for deletion
                                    if sighting[0] in pending_deletions:
                                        continue

                                    species_key = f"edit_species_{sighting[0]}"
                                    transect_key = f"edit_transect_{sighting[0]}"
                                    count_key = f"edit_count_{sighting[0]}"

                                    if all(key in st.session_state for key in [species_key, transect_key, count_key]):
                                        # Get updated values
                                        species_list = get_all_species(survey[7])
                                        species_options = {name: species_id for species_id, name in species_list}

                                        transects = get_all_transects(survey[7])
                                        transect_options = {f"{number} - {name}": transect_id for transect_id, name, number in transects}

                                        updated_sighting = Sighting(
                                            id=sighting[0],
                                            survey_id=sighting[1],
                                            species_id=species_options[st.session_state[species_key]],
                                            transect_id=transect_options[st.session_state[transect_key]],
                                            count=st.session_state[count_key]
                                        )

                                        if not update_sighting(updated_sighting):
                                            st.error("Failed to update some sightings")
                                            success = False
                                            break

                            if success:
                                # Clear pending deletions and additions
                                if pending_deletions_key in st.session_state:
                                    del st.session_state[pending_deletions_key]
                                if f"pending_sighting_additions_{survey[0]}" in st.session_state:
                                    del st.session_state[f"pending_sighting_additions_{survey[0]}"]

                                if is_new_survey:
                                    # For new surveys, set success flag
                                    st.session_state[f"survey_created_success_{survey_type}"] = True

                                    # Increment the counter to generate a new unique ID for the next survey
                                    counter_key = f"new_survey_counter_{survey_type}"
                                    st.session_state[counter_key] = st.session_state.get(counter_key, 0) + 1

                                    # Clear all new survey form data
                                    form_keys_to_clear = [
                                        f"edit_survey_{survey_type}_{survey[0]}_date",
                                        f"edit_survey_{survey_type}_{survey[0]}_surveyors",
                                        f"edit_survey_{survey_type}_{survey[0]}_start_time",
                                        f"edit_survey_{survey_type}_{survey[0]}_end_time",
                                        f"edit_survey_{survey_type}_{survey[0]}_sun_percentage",
                                        f"edit_survey_{survey_type}_{survey[0]}_temperature",
                                        f"edit_survey_{survey_type}_{survey[0]}_conditions_met",
                                        f"edit_survey_{survey_type}_{survey[0]}_notes"
                                    ]
                                    for key in form_keys_to_clear:
                                        if key in st.session_state:
                                            del st.session_state[key]
                                else:
                                    # For existing surveys, set success state
                                    st.session_state[f"survey_success_{survey[0]}"] = True

                                st.session_state.editing_survey_id = None
                                st.rerun()
                        else:
                            st.error("Failed to update survey")

        with col2:
            if st.button("❌ Discard Changes", use_container_width=True, key=f"discard_changes_btn_{survey[0]}"):
                # Check if this is a new survey
                is_new_survey = str(survey[0]).startswith("new_survey_")

                if is_new_survey:
                    # For new surveys, increment the counter to reset the form with blank fields
                    counter_key = f"new_survey_counter_{survey_type}"
                    st.session_state[counter_key] = st.session_state.get(counter_key, 0) + 1

                    # Clear all new survey form data
                    form_keys_to_clear = [
                        f"edit_survey_{survey_type}_{survey[0]}_date",
                        f"edit_survey_{survey_type}_{survey[0]}_surveyors",
                        f"edit_survey_{survey_type}_{survey[0]}_start_time",
                        f"edit_survey_{survey_type}_{survey[0]}_end_time",
                        f"edit_survey_{survey_type}_{survey[0]}_sun_percentage",
                        f"edit_survey_{survey_type}_{survey[0]}_temperature",
                        f"edit_survey_{survey_type}_{survey[0]}_conditions_met",
                        f"edit_survey_{survey_type}_{survey[0]}_notes"
                    ]
                    for key in form_keys_to_clear:
                        if key in st.session_state:
                            del st.session_state[key]

                # Clear pending deletions to restore sightings
                pending_deletions_key = f"pending_sighting_deletions_{survey[0]}"
                if pending_deletions_key in st.session_state:
                    del st.session_state[pending_deletions_key]

                # Clear pending additions
                pending_additions_key = f"pending_sighting_additions_{survey[0]}"
                if pending_additions_key in st.session_state:
                    del st.session_state[pending_additions_key]

                st.session_state.editing_survey_id = None
                st.rerun()

    # Check for success message and display it at bottom
    success_key = f"survey_success_{survey[0]}"
    if st.session_state.get(success_key, False):
        st.success("✅ **Survey changes saved successfully!**")
        # Clear the success flag so it doesn't show again
        del st.session_state[success_key]


    # Delete confirmation dialog
    if st.session_state.get("delete_confirm_id") is not None:
        # Get the survey to delete from database
        survey_to_delete = None
        all_surveys = get_all_surveys()
        for survey in all_surveys:
            if survey[0] == st.session_state.get("delete_confirm_id"):
                survey_to_delete = survey
                break
        
        if survey_to_delete:
            @st.dialog("⚠️ Confirm Survey Deletion")
            def delete_confirmation():
                st.write(f"Are you sure you want to delete the survey from **{survey_to_delete[1]}** by **{survey_to_delete[9]}**?")
                
                st.write("**This will permanently delete:**")
                st.write("- The survey record")
                st.write("- All associated butterfly sightings for this survey")
                
                st.warning("⚠️ **This action cannot be undone**")
                
                col1, col2 = st.columns(2)
                with col1:
                    if st.button("🗑️ Yes, Delete", type="primary", use_container_width=True):
                        if delete_survey(st.session_state.delete_confirm_id):
                            st.success("Survey deleted successfully!")
                            st.session_state.delete_confirm_id = None
                            st.session_state.selected_survey_id = None
                            st.rerun()
                        else:
                            st.error("Failed to delete survey")
                with col2:
                    if st.button("❌ Cancel", use_container_width=True):
                        st.session_state.delete_confirm_id = None
                        st.rerun()
            
            delete_confirmation()
    

def show():
    """Main function to display the surveys page"""
    # Initialize session state
    if "editing_survey_id" not in st.session_state:
        st.session_state.editing_survey_id = None
    if "delete_confirm_id" not in st.session_state:
        st.session_state.delete_confirm_id = None
    if "editing_sighting_id" not in st.session_state:
        st.session_state.editing_sighting_id = None
    if "creating_sighting_for_survey" not in st.session_state:
        st.session_state.creating_sighting_for_survey = None
    if "survey_search" not in st.session_state:
        st.session_state.survey_search = ""
    if "delete_sighting_confirm_id" not in st.session_state:
        st.session_state.delete_sighting_confirm_id = None
    if "new_survey_expanded_butterfly" not in st.session_state:
        st.session_state["new_survey_expanded_butterfly"] = False
    if "new_survey_expanded_bird" not in st.session_state:
        st.session_state["new_survey_expanded_bird"] = False

    # Create tabs for different survey types
    bird_tab, butterfly_tab = st.tabs(["🐦 Bird Surveys", "🦋 Butterfly Surveys"])

    with bird_tab:
        render_tab_content("bird")

    with butterfly_tab:
        render_tab_content("butterfly")