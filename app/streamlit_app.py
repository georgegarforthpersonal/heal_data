import streamlit as st
import psycopg2
from datetime import date, time, datetime
from decimal import Decimal
from typing import List, Optional, Tuple

from database.connection import get_db_cursor
from database.models import Survey, Surveyor, Sighting, Species, Transect

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
                       s.temperature_celsius, s.conditions_met, s.type,
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
                GROUP BY s.id, s.date, s.start_time, s.end_time, s.sun_percentage, s.temperature_celsius, s.conditions_met, s.type
                ORDER BY s.date DESC, s.start_time DESC
            """)
            return cursor.fetchall()
    except Exception as e:
        st.error(f"Error fetching surveys: {e}")
        return []

def format_survey_display_text(survey: Tuple, sightings_count: int) -> str:
    """Format survey for sidebar display"""
    date_str = survey[1].strftime("%b %d, %Y")
    surveyor_name = survey[9]  # Updated index after adding type field
    survey_type = survey[7].title()  # type field
    
    return f"{date_str} • {surveyor_name} ({survey_type})"

def create_survey(survey: Survey) -> Optional[int]:
    """Create a new survey and return its ID"""
    try:
        with get_db_cursor() as cursor:
            # Insert survey first
            cursor.execute("""
                INSERT INTO survey (date, start_time, end_time, sun_percentage, temperature_celsius, conditions_met, type)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                survey.date,
                survey.start_time,
                survey.end_time,
                survey.sun_percentage,
                survey.temperature_celsius,
                survey.conditions_met,
                survey.type
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
                    temperature_celsius = %s, conditions_met = %s, type = %s
                WHERE id = %s
            """, (
                survey.date,
                survey.start_time,
                survey.end_time,
                survey.sun_percentage,
                survey.temperature_celsius,
                survey.conditions_met,
                survey.type,
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
                SELECT s.id, s.date, s.start_time, s.end_time, s.sun_percentage, s.temperature_celsius, s.conditions_met, s.type,
                       ARRAY_AGG(ss.surveyor_id) FILTER (WHERE ss.surveyor_id IS NOT NULL) as surveyor_ids
                FROM survey s
                LEFT JOIN survey_surveyor ss ON s.id = ss.survey_id
                WHERE s.id = %s
                GROUP BY s.id, s.date, s.start_time, s.end_time, s.sun_percentage, s.temperature_celsius, s.conditions_met, s.type
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
                    surveyor_ids=row[8] if row[8] and row[8][0] is not None else []
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

def main_content():
    """Render the main survey interface content"""
    
    # Get all surveys
    surveys = get_all_surveys()
    
    # Main content area (no title to save space)
    
    # Main content based on selection
    if st.session_state.selected_survey_id == "new" or not surveys:
        # Show create survey form
        st.subheader("➕ Create New Survey")
        
        surveyors = get_all_surveyors()
        surveyor_options = {f"{name}": surveyor_id for surveyor_id, name in surveyors}
        surveyor_options["No surveyor"] = None
        
        with st.form("create_survey_form"):
            col1, col2 = st.columns(2)
            
            with col1:
                survey_date = st.date_input("Survey Date", value=date.today())
                start_time = st.time_input("Start Time", value=time(9, 0))
                sun_percentage = st.slider("Sun Percentage (%)", 0, 100, 50)
                survey_type = st.selectbox("Survey Type", options=["butterfly", "bird"], index=0)
            
            with col2:
                selected_surveyors = st.multiselect("Surveyors", options=list(surveyor_options.keys()))
                end_time = st.time_input("End Time", value=time(10, 0))
                temperature = st.number_input("Temperature (°C)", -50.0, 60.0, 20.0, 0.1)
            
            conditions_met = st.checkbox("Survey Conditions Met", value=False)
            
            submitted = st.form_submit_button("Create Survey", type="primary")
            
            if submitted:
                if start_time >= end_time:
                    st.error("Start time must be before end time.")
                else:
                    surveyor_ids = [surveyor_options[name] for name in selected_surveyors if surveyor_options[name] is not None]
                    new_survey = Survey(
                        date=survey_date,
                        start_time=start_time,
                        end_time=end_time,
                        sun_percentage=sun_percentage,
                        temperature_celsius=Decimal(str(temperature)),
                        conditions_met=conditions_met,
                        type=survey_type,
                        surveyor_ids=surveyor_ids if surveyor_ids else []
                    )
                    
                    new_survey_id = create_survey(new_survey)
                    if new_survey_id:
                        st.success("Survey created successfully!")
                        st.session_state.selected_survey_id = new_survey_id
                        st.session_state.editing_survey_id = None
                        st.session_state.editing_sighting_id = None
                        st.session_state.creating_sighting_for_survey = None
                        st.rerun()
    
    elif st.session_state.selected_survey_id:
        # Show selected survey details
        selected_survey = None
        for survey in surveys:
            if survey[0] == st.session_state.selected_survey_id:
                selected_survey = survey
                break
        
        if selected_survey:
            # Survey details section - no header to save space
            
            # Check if editing
            is_editing = st.session_state.editing_survey_id == selected_survey[0]
            
            if is_editing:
                # Edit mode in table format
                survey_obj = get_survey_by_id(selected_survey[0])
                if survey_obj:
                    with st.form("edit_survey_form"):
                        # Survey edit header
                        header_col1, header_col2, header_col3, header_col4, header_col5, header_col6, header_col7, header_col8 = st.columns([1.5, 1.5, 1.5, 1, 1, 1, 1.5, 1.5])
                        with header_col1:
                            st.write("**Date**")
                        with header_col2:
                            st.write("**Surveyor**")
                        with header_col3:
                            st.write("**Time**")
                        with header_col4:
                            st.write("**Temp**")
                        with header_col5:
                            st.write("**Sun**")
                        with header_col6:
                            st.write("**Conditions**")
                        with header_col7:
                            st.write("**Type**")
                        with header_col8:
                            st.write("**Actions**")
                        
                        # Edit form row
                        col1, col2, col3, col4, col5, col6, col7, col8 = st.columns([1.5, 1.5, 1.5, 1, 1, 1, 1.5, 1.5])
                        
                        with col1:
                            new_date = st.date_input("Date", value=survey_obj.date, label_visibility="collapsed")
                        
                        with col2:
                            surveyors = get_all_surveyors()
                            surveyor_options = {f"{name}": surveyor_id for surveyor_id, name in surveyors}
                            surveyor_options["No surveyor"] = None
                            
                            current_surveyors = []
                            for name, surveyor_id in surveyor_options.items():
                                if surveyor_id in (survey_obj.surveyor_ids or []):
                                    current_surveyors.append(name)
                            
                            new_surveyors = st.multiselect("Surveyors", options=list(surveyor_options.keys()), 
                                                           default=current_surveyors,
                                                           label_visibility="collapsed")
                        
                        with col3:
                            time_col1, time_col2 = st.columns([1, 1])
                            with time_col1:
                                new_start_time = st.time_input("Start", value=survey_obj.start_time, label_visibility="collapsed")
                            with time_col2:
                                new_end_time = st.time_input("End", value=survey_obj.end_time, label_visibility="collapsed")
                        
                        with col4:
                            new_temp = st.number_input("Temp", -50.0, 60.0, float(survey_obj.temperature_celsius), 0.1, label_visibility="collapsed")
                        
                        with col5:
                            new_sun = st.number_input("Sun%", 0, 100, survey_obj.sun_percentage, label_visibility="collapsed")
                        
                        with col6:
                            new_conditions = st.checkbox("✓", value=survey_obj.conditions_met, label_visibility="collapsed")
                        
                        with col7:
                            type_options = ["butterfly", "bird"]
                            current_type_index = type_options.index(survey_obj.type) if survey_obj.type in type_options else 0
                            new_type = st.selectbox("Type", options=type_options, index=current_type_index, label_visibility="collapsed")
                        
                        with col8:
                            action_col1, action_col2 = st.columns([1, 1])
                            with action_col1:
                                submitted = st.form_submit_button("💾", help="Save Changes")
                            with action_col2:
                                cancelled = st.form_submit_button("❌", help="Cancel")
                        
                        if submitted:
                            if new_start_time >= new_end_time:
                                st.error("Start time must be before end time.")
                            else:
                                surveyor_ids = [surveyor_options[name] for name in new_surveyors if surveyor_options[name] is not None]
                                updated_survey = Survey(
                                    id=survey_obj.id,
                                    date=new_date,
                                    start_time=new_start_time,
                                    end_time=new_end_time,
                                    sun_percentage=new_sun,
                                    temperature_celsius=Decimal(str(new_temp)),
                                    conditions_met=new_conditions,
                                    type=new_type,
                                    surveyor_ids=surveyor_ids if surveyor_ids else []
                                )
                                
                                if update_survey(updated_survey):
                                    st.success("Survey updated successfully!")
                                    st.session_state.editing_survey_id = None
                                    st.rerun()
                        
                        if cancelled:
                            st.session_state.editing_survey_id = None
                            st.rerun()
            else:
                # Display survey in table format matching sightings
                # Survey details header
                header_col1, header_col2, header_col3, header_col4, header_col5, header_col6, header_col7, header_col8 = st.columns([1.5, 1.5, 1.5, 1, 1, 1, 1.5, 1.5])
                with header_col1:
                    st.write("**Date**")
                with header_col2:
                    st.write("**Surveyor**")
                with header_col3:
                    st.write("**Time**")
                with header_col4:
                    st.write("**Temp**")
                with header_col5:
                    st.write("**Sun**")
                with header_col6:
                    st.write("**Conditions**")
                with header_col7:
                    st.write("**Type**")
                with header_col8:
                    st.write("**Actions**")
                
                # Survey data row
                col1, col2, col3, col4, col5, col6, col7, col8 = st.columns([1.5, 1.5, 1.5, 1, 1, 1, 1.5, 1.5])
                
                date_str = selected_survey[1].strftime("%b %d, %Y")
                start_time = selected_survey[2].strftime('%H:%M') if selected_survey[2] else "N/A"
                end_time = selected_survey[3].strftime('%H:%M') if selected_survey[3] else "N/A"
                time_str = f"{start_time}-{end_time}"
                temp_str = f"{float(selected_survey[5]):.1f}°C" if selected_survey[5] is not None else "N/A"
                sun_str = f"{selected_survey[4]}%" if selected_survey[4] is not None else "N/A"
                conditions_icon = "✅" if selected_survey[6] else "❌"
                
                with col1:
                    st.write(date_str)
                with col2:
                    st.write(selected_survey[9])
                with col3:
                    st.write(time_str)
                with col4:
                    st.write(temp_str)
                with col5:
                    st.write(sun_str)
                with col6:
                    st.write(conditions_icon)
                with col7:
                    st.write(selected_survey[7].title())  # Survey type
                with col8:
                    action_col1, action_col2 = st.columns([1, 1])
                    with action_col1:
                        if st.button("✏️", key="edit_survey_btn", help="Edit Survey"):
                            st.session_state.editing_survey_id = selected_survey[0]
                            st.rerun()
                    with action_col2:
                        if st.button("🗑️", key="delete_survey_btn", help="Delete Survey"):
                            st.session_state.delete_confirm_id = selected_survey[0]
                            st.rerun()
            
            st.divider()
            
            # Sightings section
            sightings = get_sightings_for_survey(selected_survey[0])
            
            # Add sighting button
            if st.session_state.creating_sighting_for_survey != selected_survey[0]:
                if st.button("➕ Add New Sighting", key="add_sighting_btn"):
                    st.session_state.creating_sighting_for_survey = selected_survey[0]
                    st.session_state.editing_sighting_id = None
                    st.rerun()
            
            # Create new sighting form
            if st.session_state.creating_sighting_for_survey == selected_survey[0]:
                with st.form("create_sighting_form"):
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
                            survey_id=selected_survey[0],
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
        survey_to_delete = None
        for survey in surveys:
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
    st.set_page_config(page_title="Butterfly Survey Management", layout="wide")
    
    # Initialize session state - default to create new survey
    if "selected_survey_id" not in st.session_state:
        st.session_state.selected_survey_id = "new"
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
    
    # Get all surveys
    surveys = get_all_surveys()
    
    # Sidebar for survey navigation
    with st.sidebar:
        # Create New Survey button at top
        if st.button("➕ Create New Survey", use_container_width=True, type="primary"):
            st.session_state.selected_survey_id = "new"
            st.session_state.editing_survey_id = None
            st.session_state.editing_sighting_id = None
            st.session_state.creating_sighting_for_survey = None
            st.rerun()
        
        # Survey list (no separator or heading) 
        if surveys:
            for survey in surveys:
                sightings_count = len(get_sightings_for_survey(survey[0]))
                display_text = format_survey_display_text(survey, sightings_count)
                
                # Check if this is the selected survey
                is_selected = st.session_state.selected_survey_id == survey[0]
                button_type = "primary" if is_selected else "secondary"
                
                if st.button(display_text, key=f"survey_{survey[0]}", use_container_width=True, type=button_type):
                    if not is_selected:
                        st.session_state.selected_survey_id = survey[0]
                        st.session_state.editing_survey_id = None
                        st.session_state.editing_sighting_id = None
                        st.session_state.creating_sighting_for_survey = None
                        st.rerun()
        else:
            st.info("No surveys found. Create your first survey using the button above.")
            if st.session_state.selected_survey_id != "new":
                st.session_state.selected_survey_id = "new"
    
    # Call the main content function
    main_content()

if __name__ == "__main__":
    main()