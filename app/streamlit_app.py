import streamlit as st
import sys
import os

# Add the app directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pages import surveys
from dashboards.unified_dashboard import render_dashboard, create_combined_species_chart

st.set_page_config(
    page_title="Wildlife Survey Management",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Authentication
def check_password():
    """Returns True if the user has entered the correct password."""

    # Skip authentication in dev environment
    if os.getenv('ENV', '').lower() == 'dev':
        st.session_state["password_correct"] = True
        st.session_state["is_admin"] = True
        return True

    def password_entered():
        """Checks whether a password entered by the user is correct."""
        username = st.session_state["username"]
        password = st.session_state["password"]

        # Check admin credentials
        if username == "heal-admin" and password == "turtledove":
            st.session_state["password_correct"] = True
            st.session_state["is_admin"] = True
        # Check regular user credentials
        elif username == "heal" and password == "nightingale":
            st.session_state["password_correct"] = True
            st.session_state["is_admin"] = False
        else:
            st.session_state["password_correct"] = False
            st.session_state["is_admin"] = False

        del st.session_state["password"]  # Don't store password
        del st.session_state["username"]  # Don't store username

    # Return True if password is validated
    if st.session_state.get("password_correct", False):
        return True

    # Show login form
    st.title("Wildlife Survey Management Login")
    st.text_input("Username", key="username")
    st.text_input("Password", type="password", key="password")
    st.button("Login", on_click=password_entered)

    if "password_correct" in st.session_state and not st.session_state["password_correct"]:
        st.error("Username or password incorrect")

    return False

def check_admin_access():
    """Shows admin login prompt if user is not admin. Returns True if admin access granted."""
    if st.session_state.get("is_admin", False):
        return True

    # Show admin login prompt
    st.warning("⚠️ This section requires admin access")

    with st.form("admin_login_form"):
        st.subheader("Enter Admin Credentials")
        admin_username = st.text_input("Admin Username")
        admin_password = st.text_input("Admin Password", type="password")
        submit = st.form_submit_button("Unlock Admin Access")

        if submit:
            if admin_username == "heal-admin" and admin_password == "turtledove":
                st.session_state["is_admin"] = True
                st.rerun()
            else:
                st.error("Invalid admin credentials")

    return False

# Check authentication before showing app
if not check_password():
    st.stop()

# Hide sidebar completely
st.markdown("""
<style>
    .st-emotion-cache-6qob1r {
        display: none !important;
    }
    .st-emotion-cache-1gwvy71 {
        display: none !important;
    }
    [data-testid="stSidebar"] {
        display: none !important;
    }
</style>
""", unsafe_allow_html=True)

# Top-level navigation using segmented control
is_admin = st.session_state.get("is_admin", False)

# Show different tab options based on admin status
if is_admin:
    tab_options = ["Dashboard", "Surveys", "Admin"]
    default_tab = "Dashboard"
else:
    tab_options = ["Dashboard", "Surveys", "Admin"]
    default_tab = "Dashboard"

selected_tab = st.segmented_control(
    None,
    options=tab_options,
    default=default_tab,
)

if selected_tab == "Dashboard":
    # Second-level navigation for dashboard using normal tabs
    bird_dashboard_tab, butterfly_dashboard_tab = st.tabs(["🐦 Birds", "🦋 Butterflies"])

    with bird_dashboard_tab:
        render_dashboard("bird")

    with butterfly_dashboard_tab:
        render_dashboard("butterfly")

elif selected_tab == "Surveys":
    # Check admin access for Surveys
    if not check_admin_access():
        st.stop()

    # Second-level navigation for surveys using normal tabs
    bird_surveys_tab, butterfly_surveys_tab = st.tabs(["🐦 Birds", "🦋 Butterflies"])

    with bird_surveys_tab:
        surveys.render_tab_content("bird")

    with butterfly_surveys_tab:
        surveys.render_tab_content("butterfly")

elif selected_tab == "Admin":
    # Check admin access for Admin
    if not check_admin_access():
        st.stop()

    # Import and render admin page
    from pages import admin
    admin.render_admin_page()