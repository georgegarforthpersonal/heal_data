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
            connection_params = None

            # Try to get credentials from Streamlit secrets first (for cloud deployment)
            if STREAMLIT_AVAILABLE:
                try:
                    # Check if secrets.toml exists before accessing
                    if hasattr(st, 'secrets'):
                        secrets_dict = dict(st.secrets)
                        if 'database' in secrets_dict:
                            connection_params = {
                                'host': st.secrets['database']['DB_HOST'],
                                'port': int(st.secrets['database']['DB_PORT']),
                                'database': st.secrets['database']['DB_NAME'],
                                'user': st.secrets['database']['DB_USER'],
                                'password': st.secrets['database']['DB_PASSWORD']
                            }

                            # Add SSL mode if specified
                            if 'DB_SSLMODE' in st.secrets['database']:
                                connection_params['sslmode'] = st.secrets['database']['DB_SSLMODE']
                except Exception:
                    # Secrets not available, fall through to env vars
                    pass

            # Fall back to environment variables if secrets not found
            if connection_params is None:
                connection_params = {
                    'host': os.getenv('DB_HOST', 'localhost'),
                    'port': int(os.getenv('DB_PORT', '5432')),
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
            print("✅ Database connection pool created successfully")
        except Exception as e:
            print(f"❌ Error creating connection pool: {e}")
            import traceback
            traceback.print_exc()
            _connection_pool = None

    return _connection_pool

def get_db_connection():
    """Get a connection from the pool"""
    try:
        conn_pool = get_connection_pool()
        if conn_pool:
            conn = conn_pool.getconn()

            # Validate the connection before returning it
            if conn and conn.closed:
                print("⚠️ Got closed connection from pool, removing it")
                try:
                    conn_pool.putconn(conn, close=True)
                except:
                    pass
                # Try to get a fresh connection
                conn = conn_pool.getconn()

            # Additional health check - test the connection with a simple query
            if conn and not conn.closed:
                try:
                    with conn.cursor() as cur:
                        cur.execute("SELECT 1")
                except (psycopg2.InterfaceError, psycopg2.OperationalError) as e:
                    print(f"⚠️ Connection health check failed: {e}, getting new connection")
                    try:
                        conn_pool.putconn(conn, close=True)
                    except:
                        pass
                    # Get a fresh connection
                    conn = conn_pool.getconn()

            return conn
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

def get_connection():
    """Get a database connection (alias for get_db_connection for convenience)"""
    return get_db_connection()

@contextmanager
def get_db_cursor():
    """Context manager for database operations with connection pooling"""
    conn = get_db_connection()
    if conn:
        cursor = None
        try:
            # Check if connection is still open before creating cursor
            if conn.closed:
                raise psycopg2.InterfaceError("Connection is closed")

            cursor = conn.cursor()
            yield cursor
            conn.commit()
        except (psycopg2.InterfaceError, psycopg2.OperationalError) as e:
            # Connection-related errors - close the bad connection
            print(f"⚠️ Connection error: {e}")
            if not conn.closed:
                conn.rollback()
            # Mark connection as closed so it's removed from pool
            try:
                conn_pool = get_connection_pool()
                if conn_pool:
                    conn_pool.putconn(conn, close=True)
            except:
                pass
            raise Exception(f"Database connection error: {e}")
        except Exception as e:
            if not conn.closed:
                conn.rollback()
            raise e
        finally:
            if cursor:
                try:
                    cursor.close()
                except:
                    pass
            if not conn.closed:
                return_db_connection(conn)  # Return to pool instead of closing
    else:
        raise Exception("Failed to connect to database")