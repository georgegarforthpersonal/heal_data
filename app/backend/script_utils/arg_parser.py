"""Argument parser utilities for backend scripts."""

import argparse
import logging

logger = logging.getLogger(__name__)


def get_arg_parser(description: str = None, **kwargs) -> argparse.ArgumentParser:
    """
    Create and return a standardized argument parser for backend scripts.

    Args:
        description: Description of the script (typically from __doc__)
        **kwargs: Additional keyword arguments to pass to ArgumentParser

    Returns:
        Configured ArgumentParser instance with standard dry-run arguments
    """
    parser = argparse.ArgumentParser(
        description=description,
        formatter_class=argparse.RawDescriptionHelpFormatter,
        **kwargs
    )

    # Add standard dry-run arguments
    dry_run_group = parser.add_mutually_exclusive_group()
    dry_run_group.add_argument(
        '--dry-run',
        dest='dry_run',
        action='store_true',
        default=True,
        help='Run in dry-run mode without making database changes (default)'
    )
    dry_run_group.add_argument(
        '--no-dry-run',
        dest='dry_run',
        action='store_false',
        help='Disable dry-run mode and apply changes to the database'
    )

    return parser


def log_dry_run_mode(args: argparse.Namespace) -> None:
    """
    Log the current dry-run mode status.

    Args:
        args: Parsed arguments containing dry_run attribute
    """
    mode = "dry-run" if args.dry_run else "live"
    logger.info(f"Running in {mode} mode")
    print(f"Running in {mode} mode")
