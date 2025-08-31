from email.policy import default

import streamlit as st
import psycopg2
from datetime import date, time, datetime
from decimal import Decimal
from typing import List, Optional, Tuple

from database.connection import get_db_cursor
from database.models import Survey, Surveyor, Sighting, Species, Transect
from survey_config import get_survey_fields, get_field_config, is_field_required

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

def get_all_surveyors() -> List[Tuple[int, str]]:
    """Get all surveyors for dropdown selection"""
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
        st.error(f"Error fetching surveyors: {e}")
        return []

def get_all_surveys() -> List[Tuple]:
    """Get all surveys with surveyor names"""
    try:
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
            return cursor.fetchall()
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
            
            return True
    except Exception as e:
        st.error(f"Error updating survey: {e}")
        return False

def delete_survey(survey_id: int) -> bool:
    """Delete a survey"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute("DELETE FROM survey WHERE id = %s", (survey_id,))
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

def get_all_species() -> List[Tuple[int, str]]:
    """Get all species for dropdown selection"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute("SELECT id, name FROM species ORDER BY name")
            return cursor.fetchall()
    except Exception as e:
        st.error(f"Error fetching species: {e}")
        return []

def get_all_transects() -> List[Tuple[int, str, int]]:
    """Get all transects for dropdown selection"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute("SELECT id, name, number FROM transect ORDER BY number")
            return cursor.fetchall()
    except Exception as e:
        st.error(f"Error fetching transects: {e}")
        return []

def get_sightings_for_survey(survey_id: int) -> List[Tuple]:
    """Get all sightings for a specific survey"""
    try:
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
            return cursor.fetchall()
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
            return True
    except Exception as e:
        st.error(f"Error updating sighting: {e}")
        return False

def delete_sighting(sighting_id: int) -> bool:
    """Delete a sighting"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute("DELETE FROM sighting WHERE id = %s", (sighting_id,))
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
    
    # Get all surveys filtered by type
    all_surveys = get_all_surveys()
    surveys = [survey for survey in all_surveys if survey[7].lower() == survey_type.lower()]
    
    # Create New Survey - Always at the top using custom collapsible section
    expander_state = st.session_state.get(f"new_survey_expanded_{survey_type}", False)
    
    # Force expander to be collapsed if we just created a survey
    if st.session_state.get(f"just_created_survey_{survey_type}", False):
        expander_state = False
        st.session_state[f"new_survey_expanded_{survey_type}"] = False
        del st.session_state[f"just_created_survey_{survey_type}"]
    
    # Custom expandable section with manual control
    col1, col2 = st.columns([0.05, 0.95])
    with col1:
        if st.button("➕" if not expander_state else "➖", key=f"expand_toggle_{survey_type}", help="Click to expand/collapse"):
            st.session_state[f"new_survey_expanded_{survey_type}"] = not expander_state
            st.rerun()
    
    with col2:
        st.markdown(f"### Create New {survey_type.title()} Survey")
    
    # Show content only if expanded
    if expander_state:
        # Add visual separator
        st.markdown("---")
        
        surveyors = get_all_surveyors()
        surveyor_options = {f"{name}": surveyor_id for surveyor_id, name in surveyors}
        surveyor_options["No surveyor"] = None
        
        # Initialize sightings in session state if not exists
        sightings_key = f"new_sightings_{survey_type}"
        if sightings_key not in st.session_state:
            st.session_state[sightings_key] = []
        
        # State for creating new sightings in the create form
        creating_sighting_key = f"creating_sighting_new_{survey_type}"
        
        # Survey Details Section (no form, just inputs)
        st.subheader("Survey Details")
        
        # Get configured fields for this survey type
        survey_fields = get_survey_fields(survey_type)
        
        # Store form data in session state
        form_data_key = f"create_form_data_{survey_type}"
        if form_data_key not in st.session_state:
            st.session_state[form_data_key] = {}
        
        # Render fields in a responsive layout
        col1, col2 = st.columns(2)
        col_index = 0
        
        for field_name in survey_fields:
            current_col = col1 if col_index % 2 == 0 else col2
            
            with current_col:
                if field_name == "surveyors":
                    selected_surveyors, surveyor_options = render_survey_field(field_name, survey_type, surveyors)
                    st.session_state[form_data_key][field_name] = selected_surveyors
                    st.session_state[form_data_key]["_surveyor_options"] = surveyor_options
                else:
                    field_value = render_survey_field(field_name, survey_type, surveyors)
                    st.session_state[form_data_key][field_name] = field_value
            
            col_index += 1
        
        # Sightings section (outside the form, matching existing pattern)
        st.divider()
        
        # Display existing sightings for this form
        current_sightings = st.session_state[sightings_key]
        
        # Add sighting button
        if creating_sighting_key not in st.session_state or not st.session_state[creating_sighting_key]:
            if st.button("➕ Add New Sighting", key=f"add_sighting_btn_new_{survey_type}"):
                st.session_state[creating_sighting_key] = True
                st.rerun()
        
        # Create new sighting form (matching existing UX)
        if st.session_state.get(creating_sighting_key, False):
            with st.form(f"create_sighting_form_new_{survey_type}"):
                col1, col2, col3 = st.columns(3)
                
                with col1:
                    species_list = get_all_species()
                    species_options = {name: species_id for species_id, name in species_list}
                    selected_species = st.selectbox("Species", options=list(species_options.keys()))
                
                with col2:
                    transects = get_all_transects()
                    transect_options = {f"{number} - {name}": transect_id for transect_id, name, number in transects}
                    selected_transect = st.selectbox("Transect", options=list(transect_options.keys()))
                
                with col3:
                    sighting_count = st.number_input("Count", min_value=1, value=1)
                
                col_save, col_cancel = st.columns([1, 1])
                with col_save:
                    submitted = st.form_submit_button("💾 Save Sighting", type="primary")
                with col_cancel:
                    cancelled = st.form_submit_button("❌ Cancel")
                
                if submitted:
                    # Add to the session state sightings list
                    new_sighting_data = {
                        "species_id": species_options[selected_species],
                        "transect_id": transect_options[selected_transect],
                        "count": sighting_count,
                        "species_name": selected_species,
                        "transect_display": selected_transect
                    }
                    st.session_state[sightings_key].append(new_sighting_data)
                    st.session_state[creating_sighting_key] = False
                    st.success("Sighting added!")
                    st.rerun()
                
                if cancelled:
                    st.session_state[creating_sighting_key] = False
                    st.rerun()
        
        # Display current sightings in table format
        if current_sightings:
            # Table header
            header_col1, header_col2, header_col3, header_col4 = st.columns([3, 2, 1, 2])
            with header_col1:
                st.write("**Species**")
            with header_col2:
                st.write("**Transect**")
            with header_col3:
                st.write("**Count**")
            with header_col4:
                st.write("**Actions**")
            
            for i, sighting in enumerate(current_sightings):
                col1, col2, col3, col4 = st.columns([3, 2, 1, 2])
                
                with col1:
                    st.write(sighting["species_name"])
                with col2:
                    st.write(sighting["transect_display"])
                with col3:
                    st.write(f"**{sighting['count']}**")
                with col4:
                    if st.button("🗑️", key=f"delete_new_sighting_{survey_type}_{i}", help="Delete Sighting"):
                        st.session_state[sightings_key].pop(i)
                        st.rerun()
        else:
            st.info("No sightings added yet. Click 'Add New Sighting' to get started.")
        
        # Create Survey Button (after sightings section)
        st.divider()
        
        # Validate form data before showing create button
        form_data = st.session_state.get(form_data_key, {})
        date_filled = form_data.get('date') is not None
        surveyors_filled = (
            form_data.get('surveyors') is not None and 
            len(form_data.get('surveyors', [])) > 0
        )
        required_fields_filled = date_filled and surveyors_filled
        
        if required_fields_filled:
            col1, col2, col3 = st.columns([1, 2, 1])
            with col2:
                if st.button("🦋 Create Survey", key=f"create_survey_btn_{survey_type}", type="primary", use_container_width=True):
                    # Create the survey from session state data
                    survey_data = st.session_state[form_data_key]
                    
                    # Convert surveyor names to IDs
                    surveyor_options = survey_data.get("_surveyor_options", {})
                    selected_surveyor_names = survey_data.get('surveyors', [])
                    surveyor_ids = [surveyor_options.get(name) for name in selected_surveyor_names if surveyor_options.get(name) is not None]
                    
                    # Create survey object
                    survey = Survey(
                        id=None,
                        date=survey_data['date'],
                        start_time=survey_data.get('start_time'),
                        end_time=survey_data.get('end_time'),
                        sun_percentage=survey_data.get('sun_percentage'),
                        temperature_celsius=survey_data.get('temperature'),
                        conditions_met=survey_data.get('conditions_met'),
                        surveyor_ids=surveyor_ids,
                        type=survey_type,
                        notes=survey_data.get('notes')
                    )
                    
                    # Create survey in database
                    survey_id = create_survey(survey)
                    if survey_id:
                        # Add sightings to the new survey
                        current_sightings = st.session_state[sightings_key]
                        for sighting_data in current_sightings:
                            sighting = Sighting(
                                id=None,
                                survey_id=survey_id,
                                species_id=sighting_data["species_id"],
                                transect_id=sighting_data["transect_id"],
                                count=sighting_data["count"]
                            )
                            create_sighting(sighting)
                        
                        # Set flags to force expander collapse and show success
                        st.session_state[f"new_survey_expanded_{survey_type}"] = False
                        st.session_state[f"just_created_survey_{survey_type}"] = True
                        st.session_state[f"survey_created_success_{survey_type}"] = True
                        
                        # Clear form data and sightings
                        if form_data_key in st.session_state:
                            del st.session_state[form_data_key]
                        if sightings_key in st.session_state:
                            del st.session_state[sightings_key]
                        if creating_sighting_key in st.session_state:
                            del st.session_state[creating_sighting_key]
                        
                        # Clear all form field keys from session state
                        form_field_keys = [
                            f"new_survey_{survey_type}_date",
                            f"new_survey_{survey_type}_surveyors", 
                            f"new_survey_{survey_type}_start_time",
                            f"new_survey_{survey_type}_end_time",
                            f"new_survey_{survey_type}_sun_percentage",
                            f"new_survey_{survey_type}_temperature",
                            f"new_survey_{survey_type}_conditions_met",
                            f"new_survey_{survey_type}_notes"
                        ]
                        for key in form_field_keys:
                            if key in st.session_state:
                                del st.session_state[key]
                        
                        # Collapse all historic survey expanders
                        all_surveys = get_all_surveys()
                        for survey in all_surveys:
                            if f"survey_expanded_{survey[0]}" in st.session_state:
                                st.session_state[f"survey_expanded_{survey[0]}"] = False
                        
                        # Rerun to refresh the display
                        st.rerun()
        else:
            st.warning("⚠️ Please fill in all required survey details (date and surveyor) before creating the survey.")
    
    # Display success message if survey was just created
    success_flag_key = f"survey_created_success_{survey_type}"
    if st.session_state.get(success_flag_key, False):
        st.success(f"✅ {survey_type.title()} survey created successfully!")
        # Clear the flag so message doesn't persist
        del st.session_state[success_flag_key]
    
    # Previous Surveys Section
    st.markdown("---")  # Visual separator
    st.markdown(f"## 📋 Previous {survey_type.title()} Surveys")
    
    # Filter/Search bar
    col1, col2 = st.columns([1,1])
    with col1:
        surveyors = get_all_surveyors()
        surveyor_filter_options = [name for _, name in surveyors]
        surveyor_filter = st.selectbox("Filter by Surveyor", ["All"] + surveyor_filter_options, key=f"surveyor_filter_{survey_type}")
    
    with col2:
        date_options = ["All time", "Last 3 months", "Last month", "Last week"]
        date_filter = st.selectbox("Date Range", date_options, index=2, key=f"date_filter_{survey_type}")
    
    # Filter surveys based on search and filters
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
    
    # Survey List - Each as an expander
    if filtered_surveys:
        st.write("")  # Small spacing
        for survey in filtered_surveys:
            sightings_count = len(get_sightings_for_survey(survey[0]))
            
            # Format the expander title
            date_str = survey[1].strftime("%b %d, %Y")
            surveyor_name = survey[10] if survey[10] != 'No surveyor' else 'Unknown'
            
            expander_title = f"{date_str} • {surveyor_name} • {sightings_count} sightings"
            
            # Determine if this survey should be expanded (maintain state)
            is_expanded = st.session_state.get(f"survey_expanded_{survey[0]}", False)
            
            with st.expander(expander_title, expanded=is_expanded):
                # Store expansion state
                if f"survey_expanded_{survey[0]}" not in st.session_state:
                    st.session_state[f"survey_expanded_{survey[0]}"] = is_expanded
                
                # Survey details and editing within the expander
                render_survey_content(survey)
    else:
        if surveyor_filter != "All" or date_filter != "All time":
            st.info(f"No {survey_type} surveys match your current filters.")
        else:
            st.info(f"No {survey_type} surveys found. Create your first {survey_type} survey using the form above!")

def main_content():
    """Render the main survey interface content with tabs for different survey types"""
    
    # Create tabs for different survey types
    bird_tab, butterfly_tab = st.tabs(["🐦 Bird Surveys", "🦋 Butterfly Surveys"])

    with bird_tab:
        render_tab_content("bird")

    with butterfly_tab:
        render_tab_content("butterfly")


def render_survey_content(survey):
    """Render the content for a single survey within its expander"""
    survey_type = survey[7].lower()  # Get survey type from the survey data
    survey_fields = get_survey_fields(survey_type)
    
    # Check if editing
    is_editing = st.session_state.editing_survey_id == survey[0]
    
    if is_editing:
        # Edit mode with dynamic fields based on survey type
        survey_obj = get_survey_by_id(survey[0])
        if survey_obj:
            with st.form(f"edit_survey_form_{survey[0]}"):
                surveyors = get_all_surveyors()
                
                # Create dynamic header based on configured fields
                num_fields = len(survey_fields) + 1  # +1 for actions column
                col_widths = [2] * len(survey_fields) + [2]  # Equal width columns
                
                # Header row
                header_cols = st.columns(col_widths)
                for i, field_name in enumerate(survey_fields):
                    config = get_field_config(survey_type, field_name)
                    label = config.get("label", field_name.title())
                    with header_cols[i]:
                        st.write(f"**{label}**")
                with header_cols[-1]:
                    st.write("**Actions**")
                
                # Edit form row with dynamic fields
                edit_cols = st.columns(col_widths)
                form_data = {}
                
                for i, field_name in enumerate(survey_fields):
                    with edit_cols[i]:
                        if field_name == "surveyors":
                            selected_surveyors, surveyor_options = render_survey_field_for_edit(field_name, survey_type, survey_obj, surveyors)
                            form_data[field_name] = selected_surveyors
                            form_data["_surveyor_options"] = surveyor_options
                        else:
                            form_data[field_name] = render_survey_field_for_edit(field_name, survey_type, survey_obj, surveyors)
                
                # Actions column
                with edit_cols[-1]:
                    action_col1, action_col2 = st.columns([1, 1])
                    with action_col1:
                        submitted = st.form_submit_button("💾", help="Save Changes")
                    with action_col2:
                        cancelled = st.form_submit_button("❌", help="Cancel")
                
                if submitted:
                    # Validate time fields if both exist
                    time_error = False
                    if "start_time" in form_data and "end_time" in form_data:
                        if form_data["start_time"] and form_data["end_time"] and form_data["start_time"] >= form_data["end_time"]:
                            st.error("Start time must be before end time.")
                            time_error = True
                    
                    if not time_error:
                        # Process surveyor selection
                        surveyor_ids = []
                        if "surveyors" in form_data and "_surveyor_options" in form_data:
                            selected_surveyors = form_data["surveyors"]
                            surveyor_options = form_data["_surveyor_options"]
                            surveyor_ids = [surveyor_options[name] for name in selected_surveyors if surveyor_options[name] is not None]
                        
                        # Create updated survey object with configured fields
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
                            surveyor_ids=surveyor_ids if surveyor_ids else survey_obj.surveyor_ids
                        )
                        
                        if update_survey(updated_survey):
                            st.success("Survey updated successfully!")
                            st.session_state.editing_survey_id = None
                            st.rerun()
                
                if cancelled:
                    st.session_state.editing_survey_id = None
                    st.rerun()
    else:
        # Display survey in dynamic table format based on survey type
        col_widths = [2] * len(survey_fields) + [2]  # Equal width columns + actions
        
        # Header row with dynamic fields
        header_cols = st.columns(col_widths)
        for i, field_name in enumerate(survey_fields):
            config = get_field_config(survey_type, field_name)
            label = config.get("label", field_name.title())
            with header_cols[i]:
                st.write(f"**{label}**")
        with header_cols[-1]:
            st.write("**Actions**")
        
        # Survey data row with dynamic fields
        data_cols = st.columns(col_widths)
        for i, field_name in enumerate(survey_fields):
            with data_cols[i]:
                display_value = get_survey_field_display_value(field_name, survey)
                if field_name == "notes":
                    # Use text area for better multi-line display of notes
                    st.text_area("", value=display_value, disabled=True, height=100, label_visibility="collapsed", key=f"notes_display_{survey[0]}")
                else:
                    st.write(display_value)
        
        # Actions column
        with data_cols[-1]:
            action_col1, action_col2 = st.columns([1, 1])
            with action_col1:
                if st.button("✏️", key=f"edit_survey_btn_{survey[0]}", help="Edit Survey"):
                    st.session_state.editing_survey_id = survey[0]
                    st.rerun()
            with action_col2:
                if st.button("🗑️", key=f"delete_survey_btn_{survey[0]}", help="Delete Survey"):
                    st.session_state.delete_confirm_id = survey[0]
                    st.rerun()

    st.divider()
    
    # Sightings section
    sightings = get_sightings_for_survey(survey[0])
    
    # Add sighting button
    if st.session_state.creating_sighting_for_survey != survey[0]:
        if st.button("➕ Add New Sighting", key=f"add_sighting_btn_{survey[0]}"):
            st.session_state.creating_sighting_for_survey = survey[0]
            st.session_state.editing_sighting_id = None
            st.rerun()
    
    # Create new sighting form
    if st.session_state.creating_sighting_for_survey == survey[0]:
        with st.form(f"create_sighting_form_{survey[0]}"):
            col1, col2, col3 = st.columns(3)
            
            with col1:
                species_list = get_all_species()
                species_options = {name: species_id for species_id, name in species_list}
                selected_species = st.selectbox("Species", options=list(species_options.keys()))
            
            with col2:
                transects = get_all_transects()
                transect_options = {f"{number} - {name}": transect_id for transect_id, name, number in transects}
                selected_transect = st.selectbox("Transect", options=list(transect_options.keys()))
            
            with col3:
                sighting_count = st.number_input("Count", min_value=1, value=1)
            
            col_save, col_cancel = st.columns([1, 1])
            with col_save:
                submitted = st.form_submit_button("💾 Save Sighting", type="primary")
            with col_cancel:
                cancelled = st.form_submit_button("❌ Cancel")
            
            if submitted:
                new_sighting = Sighting(
                    survey_id=survey[0],
                    species_id=species_options[selected_species],
                    transect_id=transect_options[selected_transect],
                    count=sighting_count
                )
                if create_sighting(new_sighting):
                    st.success("Sighting added successfully!")
                    st.session_state.creating_sighting_for_survey = None
                    st.rerun()
            
            if cancelled:
                st.session_state.creating_sighting_for_survey = None
                st.rerun()
    
    # Display sightings in compact table format
    if sightings:
        # Table header
        header_col1, header_col2, header_col3, header_col4 = st.columns([3, 2, 1, 2])
        with header_col1:
            st.write("**Species**")
        with header_col2:
            st.write("**Transect**")
        with header_col3:
            st.write("**Count**")
        with header_col4:
            st.write("**Actions**")
        
        for sighting in sightings:
            is_editing_sighting = st.session_state.editing_sighting_id == sighting[0]
            
            if is_editing_sighting:
                # Edit sighting form
                with st.form(f"edit_sighting_form_{sighting[0]}"):
                    col1, col2, col3, col4 = st.columns([3, 2, 1, 2])
                    
                    with col1:
                        species_list = get_all_species()
                        species_options = {name: species_id for species_id, name in species_list}
                        current_species = ""
                        for name, species_id in species_options.items():
                            if species_id == sighting[2]:
                                current_species = name
                                break
                        
                        edit_species = st.selectbox("Species", options=list(species_options.keys()), 
                                                  index=list(species_options.keys()).index(current_species),
                                                  key=f"edit_species_{sighting[0]}", label_visibility="collapsed")
                    
                    with col2:
                        transects = get_all_transects()
                        transect_options = {f"{number} - {name}": transect_id for transect_id, name, number in transects}
                        current_transect = ""
                        for transect_desc, transect_id in transect_options.items():
                            if transect_id == sighting[3]:
                                current_transect = transect_desc
                                break
                        
                        edit_transect = st.selectbox("Transect", options=list(transect_options.keys()),
                                                   index=list(transect_options.keys()).index(current_transect),
                                                   key=f"edit_transect_{sighting[0]}", label_visibility="collapsed")
                    
                    with col3:
                        edit_count = st.number_input("Count", min_value=1, value=sighting[4],
                                                   key=f"edit_count_{sighting[0]}", label_visibility="collapsed")
                    
                    with col4:
                        action_col1, action_col2 = st.columns([1, 1])
                        with action_col1:
                            submitted = st.form_submit_button("💾", help="Save Changes")
                        with action_col2:
                            cancelled = st.form_submit_button("❌", help="Cancel")
                        
                        if submitted:
                            updated_sighting = Sighting(
                                id=sighting[0],
                                survey_id=sighting[1],
                                species_id=species_options[edit_species],
                                transect_id=transect_options[edit_transect],
                                count=edit_count
                            )
                            if update_sighting(updated_sighting):
                                st.success("Sighting updated!")
                                st.session_state.editing_sighting_id = None
                                st.rerun()
                        
                        if cancelled:
                            st.session_state.editing_sighting_id = None
                            st.rerun()
            else:
                # Display sighting in compact row
                col1, col2, col3, col4 = st.columns([3, 2, 1, 2])
                
                with col1:
                    st.write(sighting[5])  # species_name
                with col2:
                    st.write(f"{sighting[6]} - {sighting[7]}")  # transect_number - transect_name
                with col3:
                    st.write(f"**{sighting[4]}**")  # count
                with col4:
                    action_col1, action_col2 = st.columns([1, 1])
                    with action_col1:
                        if st.button("✏️", key=f"edit_sighting_{sighting[0]}", help="Edit Sighting"):
                            st.session_state.editing_sighting_id = sighting[0]
                            st.session_state.creating_sighting_for_survey = None
                            st.rerun()
                    with action_col2:
                        if st.button("🗑️", key=f"delete_sighting_{sighting[0]}", help="Delete Sighting"):
                            st.session_state.delete_sighting_confirm_id = sighting[0]
                            st.rerun()
    else:
        st.info("No sightings recorded yet. Click 'Add New Sighting' to get started.")
    
    
    # Delete confirmation dialog
    if st.session_state.delete_confirm_id is not None:
        # Get the survey to delete from database
        survey_to_delete = None
        all_surveys = get_all_surveys()
        for survey in all_surveys:
            if survey[0] == st.session_state.delete_confirm_id:
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
    
    # Delete sighting confirmation dialog
    if st.session_state.delete_sighting_confirm_id is not None:
        # Find the sighting to delete
        sighting_to_delete = None
        if st.session_state.selected_survey_id:
            sightings = get_sightings_for_survey(st.session_state.selected_survey_id)
            for sighting in sightings:
                if sighting[0] == st.session_state.delete_sighting_confirm_id:
                    sighting_to_delete = sighting
                    break
        
        if sighting_to_delete:
            @st.dialog("⚠️ Confirm Sighting Deletion")
            def delete_sighting_confirmation():
                st.write(f"Are you sure you want to delete this sighting?")
                
                # Show the sighting details
                col1, col2, col3 = st.columns(3)
                with col1:
                    st.write("**Species:**")
                    st.write(sighting_to_delete[5])  # species_name
                with col2:
                    st.write("**Transect:**")
                    st.write(f"{sighting_to_delete[6]} - {sighting_to_delete[7]}")  # transect_number - transect_name
                with col3:
                    st.write("**Count:**")
                    st.write(f"**{sighting_to_delete[4]}**")  # count
                
                st.warning("⚠️ **This action cannot be undone**")
                
                col1, col2 = st.columns(2)
                with col1:
                    if st.button("🗑️ Yes, Delete", type="primary", use_container_width=True):
                        if delete_sighting(st.session_state.delete_sighting_confirm_id):
                            st.success("Sighting deleted successfully!")
                            st.session_state.delete_sighting_confirm_id = None
                            st.rerun()
                        else:
                            st.error("Failed to delete sighting")
                with col2:
                    if st.button("❌ Cancel", use_container_width=True):
                        st.session_state.delete_sighting_confirm_id = None
                        st.rerun()
            
            delete_sighting_confirmation()

def main():
    st.set_page_config(page_title="Wildlife Survey Management", layout="wide")
    
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

    # Page title
    st.title("Surveys")
    
    # Call the main content function
    main_content()

if __name__ == "__main__":
    main()