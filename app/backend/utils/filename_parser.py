"""
Filename Parser Utilities

Extracts device serial and timestamp information from media filenames.
Supports audio recordings and camera trap images with the naming convention:
    DEVICEID_YYYYMMDD_HHMMSS.ext
"""

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class MediaInfo:
    """Extracted information from a media filename."""
    device_serial: Optional[str] = None
    timestamp: Optional[datetime] = None


# Pattern: DEVICEID_YYYYMMDD_HHMMSS.ext
# DEVICEID: alphanumeric (e.g., SM4ABC123, XYZ1)
# Date: 8 digits (YYYYMMDD)
# Time: 6 digits (HHMMSS)
# Extension: any file extension
FILENAME_PATTERN = re.compile(
    r"([A-Z0-9]+)_(\d{8})_(\d{6})\.[a-zA-Z0-9]+",
    re.IGNORECASE
)


def extract_media_info(filename: str) -> MediaInfo:
    """
    Extract device serial and timestamp from a media filename.

    Supports filenames in the format: DEVICEID_YYYYMMDD_HHMMSS.ext
    Examples:
        - SM4ABC123_20250224_120456.wav -> device_serial="SM4ABC123", timestamp=2025-02-24 12:04:56
        - XYZ1_20250309_010000.jpg -> device_serial="XYZ1", timestamp=2025-03-09 01:00:00

    Args:
        filename: The media filename to parse

    Returns:
        MediaInfo with device_serial and timestamp (None if parsing fails)
    """
    match = FILENAME_PATTERN.match(filename)
    if match:
        serial, date_str, time_str = match.groups()
        try:
            timestamp = datetime.strptime(f"{date_str}_{time_str}", "%Y%m%d_%H%M%S")
            return MediaInfo(device_serial=serial, timestamp=timestamp)
        except ValueError:
            pass
    return MediaInfo()
