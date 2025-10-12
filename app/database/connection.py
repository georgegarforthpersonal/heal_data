import psycopg2
from psycopg2 import pool
import os
from contextlib import contextmanager

try:
    import streamlit as st
    STREAMLIT_AVAILABLE = True
except ImportError:
    STREAMLIT_AVAILABLE = False

# Initialize connection pool
_connection_pool = None

def get_connection_pool():
    """Get or create the connection pool"""
    global _connection_pool

    if _connection_pool is None:
        try:
            # Try to get credentials from Streamlit secrets first (for cloud deployment)
            if STREAMLIT_AVAILABLE and hasattr(st, 'secrets') and 'database' in st.secrets:
                connection_params = {
                    'host': st.secrets['database']['DB_HOST'],
                    'port': st.secrets['database']['DB_PORT'],
                    'database': st.secrets['database']['DB_NAME'],
                    'user': st.secrets['database']['DB_USER'],
                    'password': st.secrets['database']['DB_PASSWORD']
                }

                # Add SSL mode if specified
                if 'DB_SSLMODE' in st.secrets['database']:
                    connection_params['sslmode'] = st.secrets['database']['DB_SSLMODE']
            else:
                # Fall back to environment variables (for local/Docker deployment)
                connection_params = {
                    'host': os.getenv('DB_HOST', 'localhost'),
                    'port': os.getenv('DB_PORT', '5432'),
                    'database': os.getenv('DB_NAME', 'heal_butterflies'),
                    'user': os.getenv('DB_USER', 'postgres'),
                    'password': os.getenv('DB_PASSWORD', 'password')
                }

                # Add SSL mode if specified (required for Neon)
                sslmode = os.getenv('DB_SSLMODE')
                if sslmode:
                    connection_params['sslmode'] = sslmode

            # Create connection pool with 2-10 connections
            _connection_pool = pool.SimpleConnectionPool(
                minconn=2,
                maxconn=10,
                **connection_params
            )
            print("Database connection pool created successfully")
        except Exception as e:
            print(f"Error creating connection pool: {e}")
            _connection_pool = None

    return _connection_pool

def get_db_connection():
    """Get a connection from the pool"""
    try:
        conn_pool = get_connection_pool()
        if conn_pool:
            return conn_pool.getconn()
        return None
    except Exception as e:
        print(f"Error getting connection from pool: {e}")
        return None

def return_db_connection(conn):
    """Return a connection to the pool"""
    try:
        conn_pool = get_connection_pool()
        if conn_pool and conn:
            conn_pool.putconn(conn)
    except Exception as e:
        print(f"Error returning connection to pool: {e}")

@contextmanager
def get_db_cursor():
    """Context manager for database operations with connection pooling"""
    conn = get_db_connection()
    if conn:
        try:
            cursor = conn.cursor()
            yield cursor
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            return_db_connection(conn)  # Return to pool instead of closing
    else:
        raise Exception("Failed to connect to database")