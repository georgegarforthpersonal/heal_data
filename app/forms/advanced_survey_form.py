import streamlit as st
from database.connection import get_db_cursor
import pandas as pd
from datetime import date, time, datetime
import json

class AdvancedSurveyForm:
    def __init__(self):
        # Initialize session state
        if 'selected_survey_id' not in st.session_state:
            st.session_state.selected_survey_id = None
        if 'editing_survey' not in st.session_state:
            st.session_state.editing_survey = False
        if 'sightings_data' not in st.session_state:
            st.session_state.sightings_data = []
        if 'undo_stack' not in st.session_state:
            st.session_state.undo_stack = []
        if 'surveys_data' not in st.session_state:
            st.session_state.surveys_data = []
    
    def load_data(self):
        """Load all reference data from database"""
        try:
            with get_db_cursor() as cursor:
                # Load surveyors
                cursor.execute("SELECT id, first_name, last_name FROM surveyor ORDER BY first_name")
                surveyors = cursor.fetchall()
                
                # Load species
                cursor.execute("SELECT id, name FROM species ORDER BY name")
                species = cursor.fetchall()
                
                # Load transects
                cursor.execute("SELECT id, number, name FROM transect ORDER BY number")
                transects = cursor.fetchall()
                
                # Load surveys
                cursor.execute("""
                    SELECT s.id, s.date, s.start_time, s.end_time, 
                           s.sun_percentage, s.temperature_celsius, s.conditions_met,
                           s.surveyor_id, CONCAT(sv.first_name, ' ', sv.last_name) as surveyor_name
                    FROM survey s
                    LEFT JOIN surveyor sv ON s.surveyor_id = sv.id
                    ORDER BY s.date DESC, s.start_time DESC
                """)
                surveys = cursor.fetchall()
                st.session_state.surveys_data = surveys
                
                return surveyors, species, transects, surveys
        except Exception as e:
            st.error(f"Error loading data: {e}")
            return [], [], [], []
    
    def load_sightings(self, survey_id):
        """Load sightings for selected survey"""
        if not survey_id:
            return []
        
        try:
            with get_db_cursor() as cursor:
                cursor.execute("""
                    SELECT si.id, si.survey_id, si.species_id, si.transect_id, si.count,
                           sp.name as species_name, t.name as transect_name, t.number as transect_number
                    FROM sighting si
                    LEFT JOIN species sp ON si.species_id = sp.id
                    LEFT JOIN transect t ON si.transect_id = t.id
                    WHERE si.survey_id = %s
                    ORDER BY t.number, sp.name
                """, (survey_id,))
                return cursor.fetchall()
        except Exception as e:
            st.error(f"Error loading sightings: {e}")
            return []
    
    def save_survey(self, survey_data, is_new=False):
        """Save or update survey"""
        try:
            with get_db_cursor() as cursor:
                if is_new:
                    cursor.execute("""
                        INSERT INTO survey (date, start_time, end_time, sun_percentage, 
                                          temperature_celsius, conditions_met, surveyor_id)
                        VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
                    """, (survey_data['date'], survey_data['start_time'], survey_data['end_time'],
                          survey_data['sun_percentage'], survey_data['temperature_celsius'],
                          survey_data['conditions_met'], survey_data['surveyor_id']))
                    return cursor.fetchone()[0]
                else:
                    cursor.execute("""
                        UPDATE survey SET date=%s, start_time=%s, end_time=%s, 
                                        sun_percentage=%s, temperature_celsius=%s, 
                                        conditions_met=%s, surveyor_id=%s
                        WHERE id=%s
                    """, (survey_data['date'], survey_data['start_time'], survey_data['end_time'],
                          survey_data['sun_percentage'], survey_data['temperature_celsius'],
                          survey_data['conditions_met'], survey_data['surveyor_id'], survey_data['id']))
                    return survey_data['id']
        except Exception as e:
            st.error(f"Error saving survey: {e}")
            return None
    
    def save_sighting(self, sighting_data, is_new=False):
        """Save or update sighting"""
        try:
            with get_db_cursor() as cursor:
                if is_new:
                    cursor.execute("""
                        INSERT INTO sighting (survey_id, species_id, transect_id, count)
                        VALUES (%s, %s, %s, %s) RETURNING id
                    """, (sighting_data['survey_id'], sighting_data['species_id'],
                          sighting_data['transect_id'], sighting_data['count']))
                    return cursor.fetchone()[0]
                else:
                    cursor.execute("""
                        UPDATE sighting SET species_id=%s, transect_id=%s, count=%s
                        WHERE id=%s
                    """, (sighting_data['species_id'], sighting_data['transect_id'],
                          sighting_data['count'], sighting_data['id']))
                    return sighting_data['id']
        except Exception as e:
            st.error(f"Error saving sighting: {e}")
            return None
    
    def delete_sighting(self, sighting_id):
        """Delete sighting"""
        try:
            with get_db_cursor() as cursor:
                cursor.execute("DELETE FROM sighting WHERE id=%s", (sighting_id,))
                return True
        except Exception as e:
            st.error(f"Error deleting sighting: {e}")
            return False
    
    def render_survey_selector(self, surveys, surveyors):
        """Render survey selection and management"""
        st.subheader("📋 Survey Management")
        
        col1, col2 = st.columns([3, 1])
        
        with col1:
            # Survey selector
            survey_options = {}
            for survey in surveys:
                date_str = survey[1].strftime('%Y-%m-%d') if hasattr(survey[1], 'strftime') else str(survey[1])
                survey_options[f"{date_str} - {survey[8]} (ID: {survey[0]})"] = survey[0]
            
            if survey_options:
                selected_key = st.selectbox(
                    "Select Survey",
                    options=[""] + list(survey_options.keys()),
                    key="survey_selector"
                )
                if selected_key:
                    st.session_state.selected_survey_id = survey_options[selected_key]
                else:
                    st.session_state.selected_survey_id = None
            else:
                st.info("No surveys found. Create your first survey!")
        
        with col2:
            if st.button("➕ New Survey", use_container_width=True):
                self.show_new_survey_modal(surveyors)
    
    def show_new_survey_modal(self, surveyors):
        """Show new survey creation form"""
        with st.container():
            st.markdown("---")
            st.subheader("Create New Survey")
            
            with st.form("new_survey_form"):
                col1, col2 = st.columns(2)
                
                with col1:
                    survey_date = st.date_input("Survey Date", value=date.today())
                    start_time = st.time_input("Start Time", value=time(14, 0))
                    sun_percentage = st.slider("Sun Percentage", 0, 100, 75)
                
                with col2:
                    end_time = st.time_input("End Time", value=time(15, 0))
                    temperature = st.number_input("Temperature (°C)", min_value=-10.0, max_value=40.0, value=20.0, step=0.5)
                    conditions_met = st.checkbox("Survey Conditions Met", value=True)
                
                # Surveyor selection
                surveyor_options = {f"{first} {last}".strip(): id for id, first, last in surveyors}
                selected_surveyor_name = st.selectbox("Surveyor", list(surveyor_options.keys()))
                surveyor_id = surveyor_options[selected_surveyor_name]
                
                submitted = st.form_submit_button("Create Survey", use_container_width=True)
                
                if submitted:
                    survey_data = {
                        'date': survey_date,
                        'start_time': start_time,
                        'end_time': end_time,
                        'sun_percentage': sun_percentage,
                        'temperature_celsius': temperature,
                        'conditions_met': conditions_met,
                        'surveyor_id': surveyor_id
                    }
                    
                    new_survey_id = self.save_survey(survey_data, is_new=True)
                    if new_survey_id:
                        st.success(f"Survey created successfully! (ID: {new_survey_id})")
                        st.session_state.selected_survey_id = new_survey_id
                        st.rerun()
    
    def render_survey_details(self, surveys, surveyors):
        """Render current survey details"""
        if not st.session_state.selected_survey_id:
            return None
        
        current_survey = next((s for s in surveys if s[0] == st.session_state.selected_survey_id), None)
        if not current_survey:
            return None
        
        st.subheader("📊 Survey Details")
        
        col1, col2 = st.columns([4, 1])
        
        with col2:
            edit_button = st.button("✏️ Edit" if not st.session_state.editing_survey else "💾 Save")
            if edit_button:
                st.session_state.editing_survey = not st.session_state.editing_survey
                st.rerun()
        
        with col1:
            if st.session_state.editing_survey:
                # Editable form
                with st.form("edit_survey_form"):
                    col_a, col_b = st.columns(2)
                    
                    with col_a:
                        edit_date = st.date_input("Date", value=current_survey[1])
                        edit_start = st.time_input("Start Time", value=current_survey[2])
                        edit_sun = st.slider("Sun %", 0, 100, int(current_survey[4]))
                    
                    with col_b:
                        edit_end = st.time_input("End Time", value=current_survey[3])
                        edit_temp = st.number_input("Temperature (°C)", value=float(current_survey[5]))
                        edit_conditions = st.checkbox("Conditions Met", value=current_survey[6])
                    
                    surveyor_options = {f"{first} {last}".strip(): id for id, first, last in surveyors}
                    current_surveyor_name = next((name for name, id in surveyor_options.items() if id == current_survey[7]), "")
                    edit_surveyor_name = st.selectbox("Surveyor", list(surveyor_options.keys()), 
                                                    index=list(surveyor_options.keys()).index(current_surveyor_name) if current_surveyor_name else 0)
                    
                    if st.form_submit_button("Save Changes"):
                        survey_data = {
                            'id': current_survey[0],
                            'date': edit_date,
                            'start_time': edit_start,
                            'end_time': edit_end,
                            'sun_percentage': edit_sun,
                            'temperature_celsius': edit_temp,
                            'conditions_met': edit_conditions,
                            'surveyor_id': surveyor_options[edit_surveyor_name]
                        }
                        
                        if self.save_survey(survey_data, is_new=False):
                            st.success("Survey updated successfully!")
                            st.session_state.editing_survey = False
                            st.rerun()
            else:
                # Display mode
                col_a, col_b, col_c, col_d = st.columns(4)
                
                with col_a:
                    st.metric("📅 Date", current_survey[1].strftime('%Y-%m-%d') if hasattr(current_survey[1], 'strftime') else str(current_survey[1]))
                
                with col_b:
                    st.metric("🕐 Time", f"{current_survey[2]} - {current_survey[3]}")
                
                with col_c:
                    st.metric("🌡️ Conditions", f"{current_survey[5]}°C, {current_survey[4]}% sun")
                
                with col_d:
                    st.metric("👤 Surveyor", current_survey[8])
                    if current_survey[6]:
                        st.success("✅ Conditions Met")
                    else:
                        st.error("❌ Conditions Not Met")
        
        return current_survey
    
    def render_sightings_table(self, species, transects, survey_id):
        """Render interactive sightings table"""
        if not survey_id:
            return
        
        st.subheader("🦋 Butterfly Sightings")
        
        # Load current sightings
        sightings = self.load_sightings(survey_id)
        
        # Add new sighting button
        if st.button("➕ Add Sighting"):
            new_sighting_data = {
                'survey_id': survey_id,
                'species_id': species[0][0] if species else 1,
                'transect_id': transects[0][0] if transects else 1,
                'count': 1
            }
            new_id = self.save_sighting(new_sighting_data, is_new=True)
            if new_id:
                st.rerun()
        
        if not sightings:
            st.info("No sightings recorded yet. Add your first sighting!")
            return
        
        # Create interactive table
        st.markdown("### Edit Sightings")
        
        # Statistics
        total_sightings = len(sightings)
        total_count = sum(s[4] for s in sightings)
        
        col1, col2 = st.columns(2)
        with col1:
            st.metric("Total Sightings", total_sightings)
        with col2:
            st.metric("Total Butterflies", total_count)
        
        # Editable table using form
        with st.form("sightings_form"):
            st.markdown("**Edit sightings below and click 'Save All Changes'**")
            
            # Create columns for the table
            cols = st.columns([3, 3, 2, 2, 1])
            
            # Headers
            cols[0].write("**Species**")
            cols[1].write("**Transect**")
            cols[2].write("**Count**")
            cols[3].write("**Actions**")
            
            # Track changes
            updated_sightings = []
            sightings_to_delete = []
            
            for i, sighting in enumerate(sightings):
                with cols[0]:
                    species_options = {name: id for id, name in species}
                    current_species = next((name for id, name in species if id == sighting[2]), "")
                    selected_species = st.selectbox("", list(species_options.keys()), 
                                                  key=f"species_{sighting[0]}",
                                                  index=list(species_options.keys()).index(current_species) if current_species else 0)
                
                with cols[1]:
                    transect_options = {f"{num}. {name}": id for id, num, name in transects}
                    current_transect = next((f"{sighting[7]}. {sighting[6]}" for id, num, name in transects if id == sighting[3]), "")
                    selected_transect = st.selectbox("", list(transect_options.keys()),
                                                   key=f"transect_{sighting[0]}",
                                                   index=list(transect_options.keys()).index(current_transect) if current_transect else 0)
                
                with cols[2]:
                    count = st.number_input("", min_value=1, max_value=1000, value=int(sighting[4]), 
                                          key=f"count_{sighting[0]}")
                
                with cols[3]:
                    if st.checkbox("Delete", key=f"delete_{sighting[0]}"):
                        sightings_to_delete.append(sighting[0])
                
                # Store updated values
                if sighting[0] not in sightings_to_delete:
                    updated_sightings.append({
                        'id': sighting[0],
                        'survey_id': survey_id,
                        'species_id': species_options[selected_species],
                        'transect_id': transect_options[selected_transect],
                        'count': count
                    })
            
            # Save button
            if st.form_submit_button("💾 Save All Changes", use_container_width=True):
                try:
                    # Delete marked sightings
                    for sighting_id in sightings_to_delete:
                        self.delete_sighting(sighting_id)
                    
                    # Update remaining sightings
                    for sighting_data in updated_sightings:
                        self.save_sighting(sighting_data, is_new=False)
                    
                    if sightings_to_delete or updated_sightings:
                        st.success("Changes saved successfully!")
                        st.rerun()
                
                except Exception as e:
                    st.error(f"Error saving changes: {e}")
    
    def render(self):
        """Main render method"""
        st.title("🦋 Advanced Butterfly Survey Form")
        st.markdown("*Interactive form for recording butterfly survey data*")
        
        # Load data
        surveyors, species, transects, surveys = self.load_data()
        
        if not surveyors or not species or not transects:
            st.error("Missing reference data! Please ensure surveyors, species, and transects are configured.")
            return
        
        # Render components
        self.render_survey_selector(surveys, surveyors)
        
        st.markdown("---")
        
        current_survey = self.render_survey_details(surveys, surveyors)
        
        if current_survey:
            st.markdown("---")
            self.render_sightings_table(species, transects, st.session_state.selected_survey_id)