#!/usr/bin/env python3
"""
Read-only diagnostic: find duplicate surveyor names (same normalised name,
same organisation) and recent surveyor-row creations, to see how duplicates
are being produced and whether survey_surveyor links are being lost.

Usage:
    ./run prod inspect_surveyor_duplicates.py
"""

import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.orm import Session

from database.connection import get_engine

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


def main() -> None:
    with Session(get_engine()) as db:
        logger.info("=== Duplicate surveyor names (same org, case-insensitive) ===")
        rows = db.execute(text("""
            SELECT o.name AS org, s.first_name, coalesce(s.last_name, '') AS last_name,
                   count(*) AS n,
                   array_agg(s.id ORDER BY s.id) AS ids,
                   array_agg(s.is_active ORDER BY s.id) AS active,
                   array_agg(coalesce(s.user_id, -1) ORDER BY s.id) AS user_ids,
                   array_agg(s.created_at ORDER BY s.id) AS created
            FROM surveyor s JOIN organisation o ON o.id = s.organisation_id
            GROUP BY o.name, lower(s.first_name), lower(coalesce(s.last_name, '')),
                     s.first_name, coalesce(s.last_name, '')
            HAVING count(*) > 1
            ORDER BY o.name, count(*) DESC
        """)).fetchall()
        for r in rows:
            logger.info(f"  {r.org}: '{r.first_name} {r.last_name}' x{r.n} ids={r.ids} active={r.active} user_ids={r.user_ids} created={r.created}")
        if not rows:
            logger.info("  none")

        logger.info("\n=== Surveyor rows created in the last 45 days ===")
        rows = db.execute(text("""
            SELECT s.id, s.first_name, coalesce(s.last_name,'') AS last_name, o.name AS org,
                   s.is_active, s.user_id, s.created_at,
                   (SELECT count(*) FROM survey_surveyor ss WHERE ss.surveyor_id = s.id) AS survey_links
            FROM surveyor s JOIN organisation o ON o.id = s.organisation_id
            WHERE s.created_at > now() - interval '45 days'
            ORDER BY s.created_at
        """)).fetchall()
        for r in rows:
            logger.info(f"  {r.created_at}  id={r.id}  '{r.first_name} {r.last_name}'  org={r.org}  active={r.is_active}  user_id={r.user_id}  surveys={r.survey_links}")
        if not rows:
            logger.info("  none")

        logger.info("\n=== Recent surveys (last 30 days by survey date) with surveyor lists ===")
        rows = db.execute(text("""
            SELECT sv.id, sv.date, o.name AS org, st.name AS survey_type, sv.created_at,
                   (SELECT count(*) FROM survey_surveyor ss WHERE ss.survey_id = sv.id) AS n_surveyors,
                   (SELECT array_agg(ss.surveyor_id ORDER BY ss.surveyor_id) FROM survey_surveyor ss WHERE ss.survey_id = sv.id) AS surveyor_ids
            FROM survey sv
            JOIN organisation o ON o.id = sv.organisation_id
            LEFT JOIN survey_type st ON st.id = sv.survey_type_id
            WHERE sv.date > now() - interval '30 days'
            ORDER BY sv.date DESC
            LIMIT 40
        """)).fetchall()
        for r in rows:
            logger.info(f"  survey={r.id}  {r.date}  {r.org}/{r.survey_type}  created={r.created_at}  surveyors={r.n_surveyors} {r.surveyor_ids}")

        logger.info("\n=== Inactive surveyors still attached to surveys ===")
        rows = db.execute(text("""
            SELECT s.id, s.first_name, coalesce(s.last_name,'') AS last_name, o.name AS org,
                   count(ss.survey_id) AS surveys
            FROM surveyor s
            JOIN organisation o ON o.id = s.organisation_id
            JOIN survey_surveyor ss ON ss.surveyor_id = s.id
            WHERE NOT s.is_active
            GROUP BY s.id, s.first_name, coalesce(s.last_name,''), o.name
            ORDER BY count(ss.survey_id) DESC
        """)).fetchall()
        for r in rows:
            logger.info(f"  id={r.id}  '{r.first_name} {r.last_name}'  org={r.org}  surveys={r.surveys}")
        if not rows:
            logger.info("  none")


if __name__ == "__main__":
    main()
