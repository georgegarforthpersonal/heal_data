"""
Database Connection Management for FastAPI Backend

Adapted from Streamlit POC (../../app/database/connection.py)
Uses connection pooling for efficient database access.
Reads configuration from environment variables.
"""

import psycopg2
from psycopg2 import pool
import os
from contextlib import contextmanager
from typing import Optional

# Initialize connection pool
_connection_pool: Optional[pool.SimpleConnectionPool] = None


def get_connection_pool() -> Optional[pool.SimpleConnectionPool]:
    """
    Get or create the connection pool.

    Reads database configuration from environment variables:
    - DB_HOST: Database host (default: localhost)
    - DB_PORT: Database port (default: 5432)
    - DB_NAME: Database name (default: heal_butterflies)
    - DB_USER: Database user (default: postgres)
    - DB_PASSWORD: Database password (default: password)
    - DB_SSLMODE: SSL mode (optional, required for Neon)

    Returns:
        Connection pool or None if creation failed
    """
    global _connection_pool

    if _connection_pool is None:
        try:
            # Get credentials from environment variables
            connection_params = {
                'host': os.getenv('DB_HOST', 'localhost'),
                'port': int(os.getenv('DB_PORT', '5432')),
                'database': os.getenv('DB_NAME', 'heal_butterflies'),
                'user': os.getenv('DB_USER', 'postgres'),
                'password': os.getenv('DB_PASSWORD', 'password')
            }

            # Add SSL mode if specified (required for Neon production)
            sslmode = os.getenv('DB_SSLMODE')
            if sslmode:
                connection_params['sslmode'] = sslmode

            # Create connection pool with 2-10 connections
            _connection_pool = pool.SimpleConnectionPool(
                minconn=2,
                maxconn=10,
                **connection_params
            )

            print(f"✅ Database connection pool created: {connection_params['host']}/{connection_params['database']}")

        except Exception as e:
            print(f"❌ Error creating connection pool: {e}")
            import traceback
            traceback.print_exc()
            _connection_pool = None

    return _connection_pool


def get_db_connection():
    """
    Get a connection from the pool with health checking.

    Returns:
        Database connection or None if unavailable
    """
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
        print(f"❌ Error getting connection from pool: {e}")
        return None


def return_db_connection(conn):
    """
    Return a connection to the pool.

    Args:
        conn: Database connection to return
    """
    try:
        conn_pool = get_connection_pool()
        if conn_pool and conn:
            conn_pool.putconn(conn)
    except Exception as e:
        print(f"❌ Error returning connection to pool: {e}")


@contextmanager
def get_db_cursor():
    """
    Context manager for database operations with connection pooling.

    Automatically handles:
    - Getting connection from pool
    - Creating cursor
    - Committing successful transactions
    - Rolling back failed transactions
    - Returning connection to pool

    Usage:
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM surveys")
            results = cursor.fetchall()

    Yields:
        Database cursor

    Raises:
        Exception: If database connection fails or query errors occur
    """
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


def close_connection_pool():
    """
    Close all connections in the pool.
    Should be called on application shutdown.
    """
    global _connection_pool
    if _connection_pool:
        try:
            _connection_pool.closeall()
            print("✅ Database connection pool closed")
        except Exception as e:
            print(f"❌ Error closing connection pool: {e}")
        finally:
            _connection_pool = None
