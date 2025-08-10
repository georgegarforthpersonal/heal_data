import streamlit as st
from database.connection import get_db_cursor
from database.models import User, ButterflyRecord

class UserForm:
    def render(self):
        st.subheader("User Management")
        
        tab1, tab2, tab3 = st.tabs(["Add User", "Add Butterfly Record", "View Records"])
        
        with tab1:
            self._render_user_form()
            
        with tab2:
            self._render_butterfly_form()
            
        with tab3:
            self._render_records_view()
    
    def _render_user_form(self):
        st.header("Add New User")
        
        with st.form("user_form"):
            name = st.text_input("Name", placeholder="Enter user name")
            email = st.text_input("Email", placeholder="Enter email address")
            
            submitted = st.form_submit_button("Add User")
            
            if submitted:
                if name and email:
                    try:
                        with get_db_cursor() as cursor:
                            cursor.execute(
                                "INSERT INTO users (name, email) VALUES (%s, %s) RETURNING id",
                                (name, email)
                            )
                            user_id = cursor.fetchone()[0]
                            st.success(f"User '{name}' added successfully with ID: {user_id}")
                    except Exception as e:
                        st.error(f"Error adding user: {e}")
                else:
                    st.error("Please fill in all fields")
    
    def _render_butterfly_form(self):
        st.header("Add Butterfly Record")
        
        try:
            with get_db_cursor() as cursor:
                cursor.execute("SELECT id, name FROM users ORDER BY name")
                users = cursor.fetchall()
        except Exception as e:
            st.error(f"Error fetching users: {e}")
            users = []
        
        with st.form("butterfly_form"):
            species = st.text_input("Species", placeholder="Enter butterfly species")
            status = st.selectbox("Status", ["Injured", "Healing", "Healthy", "Released"])
            location = st.text_input("Location", placeholder="Where was it found?")
            notes = st.text_area("Notes", placeholder="Additional observations")
            
            if users:
                user_options = {f"{name} (ID: {id})": id for id, name in users}
                selected_user = st.selectbox("User", list(user_options.keys()))
                user_id = user_options[selected_user] if selected_user else None
            else:
                st.warning("No users found. Please add a user first.")
                user_id = None
            
            submitted = st.form_submit_button("Add Record")
            
            if submitted:
                if species and status and user_id:
                    try:
                        with get_db_cursor() as cursor:
                            cursor.execute(
                                """INSERT INTO butterfly_records 
                                   (species, status, location, notes, user_id) 
                                   VALUES (%s, %s, %s, %s, %s) RETURNING id""",
                                (species, status, location, notes, user_id)
                            )
                            record_id = cursor.fetchone()[0]
                            st.success(f"Butterfly record added successfully with ID: {record_id}")
                    except Exception as e:
                        st.error(f"Error adding record: {e}")
                else:
                    st.error("Please fill in required fields (species, status, user)")
    
    def _render_records_view(self):
        st.header("Butterfly Records")
        
        try:
            with get_db_cursor() as cursor:
                cursor.execute("""
                    SELECT br.id, br.species, br.status, br.location, br.notes, 
                           u.name, br.created_at
                    FROM butterfly_records br
                    JOIN users u ON br.user_id = u.id
                    ORDER BY br.created_at DESC
                """)
                records = cursor.fetchall()
                
                if records:
                    for record in records:
                        with st.expander(f"{record[1]} - {record[2]} (ID: {record[0]})"):
                            st.write(f"**Species:** {record[1]}")
                            st.write(f"**Status:** {record[2]}")
                            st.write(f"**Location:** {record[3] or 'Not specified'}")
                            st.write(f"**Notes:** {record[4] or 'No notes'}")
                            st.write(f"**Recorded by:** {record[5]}")
                            st.write(f"**Date:** {record[6]}")
                else:
                    st.info("No butterfly records found.")
                    
        except Exception as e:
            st.error(f"Error fetching records: {e}")