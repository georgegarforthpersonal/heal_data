"""Argument parser utilities for backend scripts."""

import argparse


def get_arg_parser(description: str = None, **kwargs) -> argparse.ArgumentParser:
    """
    Create and return a standardized argument parser for backend scripts.

    Args:
        description: Description of the script (typically from __doc__)
        **kwargs: Additional keyword arguments to pass to ArgumentParser

    Returns:
        Configured ArgumentParser instance
    """
    parser = argparse.ArgumentParser(
        description=description,
        formatter_class=argparse.RawDescriptionHelpFormatter,
        **kwargs
    )

    return parser
