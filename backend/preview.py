"""
Which files can be previewed in the browser, and how they are served.

Only types that a browser can show safely are listed. Anything that can run
code (HTML, SVG, scripts) is deliberately absent, because a preview URL serves
the file inline from the storage domain. CSV is served as plain text so the
browser displays it instead of offering a download.
"""

import os

PREVIEW_CONTENT_TYPES: dict[str, str] = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".txt": "text/plain; charset=utf-8",
    ".csv": "text/plain; charset=utf-8",
}


def preview_content_type(display_name: str) -> str | None:
    """Content type to serve the file as, or None if it cannot be previewed."""
    extension = os.path.splitext(display_name)[1].lower()
    return PREVIEW_CONTENT_TYPES.get(extension)
