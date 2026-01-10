"""
NBN Atlas API Client for Species Profile section.

API Documentation: https://docs.nbnatlas.org/web-service-api/
Base URL: https://species-ws.nbnatlas.org/
"""

import requests
from typing import Dict, List, Optional, Any


class NBNAtlasClient:
    """Client for interacting with the NBN Atlas Species API."""

    BASE_URL = "https://species-ws.nbnatlas.org"

    def __init__(self, timeout: int = 30):
        """
        Initialize the NBN Atlas API client.

        Args:
            timeout: Request timeout in seconds (default: 30)
        """
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "NBNAtlasClient/1.0"
        })

    def search(
        self,
        query: str = "*:*",
        filter_query: Optional[str | List[str]] = None,
        page_size: int = 10,
        start: int = 0,
        sort: Optional[str] = None,
        facets: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Search for species using the NBN Atlas search API.

        Args:
            query: The main search query (default: "*:*" for all records)
            filter_query: Additional filter query or list of queries (e.g., "speciesGroup:Birds" or ["taxonGroup:insect*", "-taxonGroup:butterfly"])
            page_size: Number of results per page (default: 10, max: 1000)
            start: Starting offset for pagination (default: 0)
            sort: Sort order (e.g., "scientificName")
            facets: List of facet fields to include

        Returns:
            Dictionary containing search results with structure:
            {
                "searchResults": {
                    "totalRecords": int,
                    "results": List[Dict],
                    "facetResults": List[Dict]
                }
            }
        """
        params = {
            "q": query,
            "pageSize": page_size,
            "start": start
        }

        if filter_query:
            # Support both single string and list of filter queries
            if isinstance(filter_query, list):
                params["fq"] = filter_query
            else:
                params["fq"] = filter_query

        if sort:
            params["sort"] = sort

        if facets:
            params["facets"] = ",".join(facets)

        url = f"{self.BASE_URL}/search"
        response = self.session.get(url, params=params, timeout=self.timeout)
        response.raise_for_status()

        return response.json()

    def search_all(
        self,
        query: str = "*:*",
        filter_query: Optional[str | List[str]] = None,
        page_size: int = 100,
        max_records: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Search and retrieve all matching species records (paginated).

        Args:
            query: The main search query (default: "*:*" for all records)
            filter_query: Additional filter query or list of queries (e.g., "speciesGroup:Birds" or ["taxonGroup:insect*", "-taxonGroup:butterfly"])
            page_size: Number of results per page (default: 100)
            max_records: Maximum number of records to retrieve (default: all)

        Returns:
            List of all matching species records
        """
        all_results = []
        start = 0

        while True:
            response = self.search(
                query=query,
                filter_query=filter_query,
                page_size=page_size,
                start=start
            )

            search_results = response.get("searchResults", {})
            results = search_results.get("results", [])

            if not results:
                break

            all_results.extend(results)

            # Check if we've reached max_records limit
            if max_records and len(all_results) >= max_records:
                all_results = all_results[:max_records]
                break

            # Check if we've retrieved all available records
            total_records = search_results.get("totalRecords", 0)
            if len(all_results) >= total_records:
                break

            start += page_size

        return all_results

    def close(self):
        """Close the session."""
        self.session.close()

    def __enter__(self):
        """Context manager entry."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.close()
