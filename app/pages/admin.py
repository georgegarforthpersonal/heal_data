import streamlit as st
from typing import List, Tuple, Optional
from database.connection import get_db_cursor
import pandas as pd
from pages.surveys import get_all_surveyors

@st.cache_data(ttl=60)  # Cache for 1 minute
def get_all_surveyors_admin() -> List[Tuple]:
    """Get all surveyors with their details for admin view"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute("""
                SELECT id, first_name, last_name
                FROM surveyor
                ORDER BY first_name, last_name
            """)
            return cursor.fetchall()
    except Exception as e:
        st.error(f"Error fetching surveyors: {e}")
        return []

def add_surveyor(first_name: str, last_name: str) -> bool:
    """Add a new surveyor to the database"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute("""
                INSERT INTO surveyor (first_name, last_name)
                VALUES (%s, %s)
                RETURNING id
            """, (first_name.strip(), last_name.strip()))
            surveyor_id = cursor.fetchone()[0]
            # Clear both admin and surveys caches
            get_all_surveyors_admin.clear()
            get_all_surveyors.clear()
            # Set success flag for toast message
            st.session_state["surveyor_added_success"] = {
                "first_name": first_name,
                "last_name": last_name,
                "surveyor_id": surveyor_id
            }
            return True
    except Exception as e:
        st.error(f"❌ Error adding surveyor: {e}")
        return False

def delete_surveyor(surveyor_id: int, surveyor_name: str) -> bool:
    """Delete a surveyor from the database"""
    try:
        with get_db_cursor() as cursor:
            # Check if surveyor is associated with any surveys
            cursor.execute("""
                SELECT COUNT(*) FROM survey_surveyor WHERE surveyor_id = %s
            """, (surveyor_id,))
            count = cursor.fetchone()[0]

            if count > 0:
                st.error(f"❌ Cannot delete {surveyor_name} - associated with {count} survey(s). Remove associations first.")
                return False

            # Delete the surveyor
            cursor.execute("""
                DELETE FROM surveyor WHERE id = %s
            """, (surveyor_id,))
            # Clear both admin and surveys caches
            get_all_surveyors_admin.clear()
            get_all_surveyors.clear()
            # Set success flag for toast message
            st.session_state["surveyor_deleted_success"] = surveyor_name
            return True
    except Exception as e:
        st.error(f"❌ Error deleting surveyor: {e}")
        return False

def render_admin_page():
    """Render the admin page with surveyor management"""
    st.header("Surveyors")

    # Show toast messages for success operations
    if "surveyor_added_success" in st.session_state:
        info = st.session_state["surveyor_added_success"]
        surveyor_name = f"{info['first_name']} {info['last_name']}"
        st.toast(f"Successfully added surveyor: {surveyor_name}", icon="✅", duration="short")
        del st.session_state["surveyor_added_success"]

    if "surveyor_deleted_success" in st.session_state:
        surveyor_name = st.session_state["surveyor_deleted_success"]
        st.toast(f"Successfully deleted surveyor: {surveyor_name}", icon="✅", duration="short")
        del st.session_state["surveyor_deleted_success"]

    # Information section
    st.markdown("""
    **Surveyor Management:**
    - First name is required
    - Last name is optional
    - Surveyors can be assigned to bird and butterfly surveys
    - Cannot delete surveyors that are associated with surveys
    """)

    st.divider()

    # Display existing surveyors
    surveyors = get_all_surveyors_admin()

    if surveyors:
        # Convert to DataFrame for display (without ID column)
        df = pd.DataFrame(surveyors, columns=['ID', 'First Name', 'Last Name'])
        df = df[['First Name', 'Last Name']]  # Drop ID column

        st.dataframe(
            df,
            use_container_width=True,
            hide_index=True,
            column_config={
                "First Name": st.column_config.TextColumn("First Name", width="medium"),
                "Last Name": st.column_config.TextColumn("Last Name", width="medium"),
            }
        )

        st.caption(f"Total surveyors: {len(surveyors)}")
    else:
        st.info("No surveyors found. Add one using the form below.")

    st.divider()

    # Create two columns for Add and Delete
    col1, col2 = st.columns(2)

    with col1:
        st.subheader("Add Surveyor")

        with st.form("add_surveyor_form", clear_on_submit=True):
            first_name = st.text_input(
                "First Name *",
                placeholder="Enter first name",
                help="Required field"
            )

            last_name = st.text_input(
                "Last Name",
                placeholder="Enter last name",
                help="Optional field"
            )

            submit = st.form_submit_button("➕ Add Surveyor", type="primary", use_container_width=True)

            if submit:
                # Validate input
                if not first_name or not first_name.strip():
                    st.error("❌ First name is required")
                else:
                    # Add the surveyor
                    if add_surveyor(first_name, last_name if last_name else ""):
                        st.rerun()

    with col2:
        st.subheader("Delete Surveyor")

        if surveyors:
            with st.form("delete_surveyor_form"):
                # Create dropdown with surveyor names
                surveyor_options = {f"{s[1]} {s[2]}".strip(): (s[0], f"{s[1]} {s[2]}".strip()) for s in surveyors}

                selected_surveyor = st.selectbox(
                    "Select surveyor to delete:",
                    options=["Choose a surveyor..."] + list(surveyor_options.keys()),
                    key="delete_surveyor_select"
                )

                delete_btn = st.form_submit_button("🗑️ Delete Surveyor", type="secondary", use_container_width=True)

                if delete_btn:
                    if selected_surveyor == "Choose a surveyor...":
                        st.error("❌ Please select a surveyor to delete")
                    else:
                        surveyor_id, surveyor_name = surveyor_options[selected_surveyor]
                        if delete_surveyor(surveyor_id, surveyor_name):
                            st.rerun()
        else:
            st.info("No surveyors to delete.")
