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
        return True

    def password_entered():
        """Checks whether a password entered by the user is correct."""
        if (st.session_state["username"] == "heal" and
            st.session_state["password"] == "nightingale"):
            st.session_state["password_correct"] = True
            del st.session_state["password"]  # Don't store password
            del st.session_state["username"]  # Don't store username
        else:
            st.session_state["password_correct"] = False

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
selected_tab = st.segmented_control(
    None,
    options=["Surveys", "Dashboard", "Report"],
    default="Surveys",
)

if selected_tab == "Surveys":
    # Second-level navigation for surveys using normal tabs
    bird_surveys_tab, butterfly_surveys_tab = st.tabs(["🐦 Birds", "🦋 Butterflies"])
    
    with bird_surveys_tab:
        surveys.render_tab_content("bird")
    
    with butterfly_surveys_tab:
        surveys.render_tab_content("butterfly")

elif selected_tab == "Dashboard":
    # Second-level navigation for dashboard using normal tabs
    bird_dashboard_tab, butterfly_dashboard_tab = st.tabs(["🐦 Birds", "🦋 Butterflies"])

    with bird_dashboard_tab:
        render_dashboard("bird")

    with butterfly_dashboard_tab:
        render_dashboard("butterfly")

elif selected_tab == "Report":
    # Show combined species report
    st.header("Combined Species Report")

    # Combined chart
    combined_fig = create_combined_species_chart()
    if combined_fig:
        st.plotly_chart(combined_fig, use_container_width=True)
    else:
        st.error("Unable to load combined species chart")