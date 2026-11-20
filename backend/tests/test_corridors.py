"""Corridor registry tests (stdlib unittest, no network).

Run (from the backend/ directory):  python -m unittest discover -s tests

These tests assert per-corridor catalogs, validation scoping, and GB
backward compatibility. No test touches the network: retrieval is never
invoked without a scripted opener.
"""

from __future__ import annotations

import unittest
from urllib.parse import urlsplit

from app.corridors import (
    DEFAULT_PROFILE,
    PROFILES,
    get_profile,
    list_profiles,
    profile_catalog,
    profile_urls,
)
from app.official_sources import (
    ALLOWLIST,
    AllowlistRedirectHandler,
    build_retrieval_opener,
    validate_allowlisted_url,
)


class RegistryTests(unittest.TestCase):
    def test_default_profile_is_gb(self):
        self.assertEqual(DEFAULT_PROFILE, "GB")
        self.assertEqual(get_profile(None).code, "GB")
        self.assertEqual(get_profile("gb").code, "GB")
        self.assertEqual(get_profile("  SG ").code, "SG")

    def test_all_nine_profiles_exist_with_metadata(self):
        self.assertEqual(
            sorted(PROFILES),
            ["AU", "GB", "HK", "ID", "JP", "MY", "NZ", "SG", "TW"],
        )
        for profile in PROFILES.values():
            self.assertTrue(profile.display_name)
            self.assertIn(profile.kind, ("origin", "destination", "jurisdiction"))
            self.assertIn(profile.status, ("sources_verified", "partial"))
            self.assertTrue(profile.languages)
            self.assertTrue(profile.hosts)
            self.assertTrue(profile.sources)

    def test_gb_profile_reuses_the_original_allowlist(self):
        profile = get_profile("GB")
        self.assertEqual(profile.display_name, "United Kingdom")
        self.assertEqual(list(profile.sources), list(ALLOWLIST))
        self.assertEqual(
            [source.id for source in profile_catalog("GB").values()],
            [source.id for source in ALLOWLIST],
        )

    def test_unknown_profile_codes_are_rejected(self):
        for code in ("XX", "UK", "CN"):
            with self.assertRaises(ValueError, msg=repr(code)):
                get_profile(code)
        # Empty input means "no selection": it falls back to the default.
        self.assertEqual(get_profile(""), get_profile(None))

    def test_list_profiles_shape(self):
        profiles = list_profiles()
        self.assertEqual(len(profiles), 9)
        for entry in profiles:
            for field in (
                "code",
                "display_name",
                "kind",
                "status",
                "last_reviewed",
                "languages",
                "source_count",
            ):
                self.assertIn(field, entry)


class ContaminationTests(unittest.TestCase):
    def test_source_ids_are_unique_across_profiles(self):
        seen: dict[str, str] = {}
        for code in PROFILES:
            for source_id in profile_catalog(code):
                self.assertNotIn(
                    source_id, seen, f"{source_id} in both {seen.get(source_id)} and {code}"
                )
                seen[source_id] = code

    def test_every_source_url_matches_its_profile_hosts(self):
        for code, profile in PROFILES.items():
            for url in profile_urls(code):
                parts = urlsplit(url)
                self.assertEqual(parts.scheme, "https", url)
                self.assertFalse(parts.fragment, url)
                self.assertIn(parts.hostname, profile.hosts, url)

    def test_gov_uk_appears_only_under_gb(self):
        for code in PROFILES:
            for url in profile_urls(code):
                if "gov.uk" in urlsplit(url).hostname:
                    self.assertEqual(code, "GB", url)

    def test_non_retrievable_references_are_excluded(self):
        all_urls = [url for code in PROFILES for url in profile_urls(code)]
        for url in all_urls:
            self.assertNotIn("mwc.org.sg", url)  # non-governmental: link-out only
            self.assertFalse(url.lower().endswith(".pdf"), url)  # HTML-only pipeline


class ValidationScopingTests(unittest.TestCase):
    def test_profile_urls_validate_under_their_own_profile_only(self):
        sg_url = "https://www.mom.gov.sg/passes-and-permits"
        self.assertEqual(
            validate_allowlisted_url(sg_url, profile_urls("SG")), sg_url
        )
        with self.assertRaises(ValueError):
            validate_allowlisted_url(sg_url)  # GB default rejects it
        with self.assertRaises(ValueError):
            validate_allowlisted_url(sg_url, profile_urls("JP"))
        gb_url = "https://www.gov.uk/seasonal-worker-visa"
        with self.assertRaises(ValueError):
            validate_allowlisted_url(gb_url, profile_urls("SG"))

    def test_same_path_different_query_stays_distinct(self):
        act = "https://law.moj.gov.tw/ENG/LawClass/LawAll.aspx?pcode=N0090001"
        fees = "https://law.moj.gov.tw/ENG/LawClass/LawAll.aspx?pcode=N0090028"
        urls = profile_urls("TW")
        self.assertEqual(validate_allowlisted_url(act, urls), act)
        self.assertEqual(validate_allowlisted_url(fees, urls), fees)
        with self.assertRaises(ValueError):
            validate_allowlisted_url(
                "https://law.moj.gov.tw/ENG/LawClass/LawAll.aspx?pcode=N0090099", urls
            )

    def test_redirect_handler_carries_its_profile_set(self):
        default_handler = AllowlistRedirectHandler()
        self.assertIsNone(default_handler._allowed_urls)
        scoped = AllowlistRedirectHandler(profile_urls("SG"))
        self.assertIn("https://www.mom.gov.sg/", scoped._allowed_urls)
        opener = build_retrieval_opener(profile_urls("SG"))
        handlers = [
            handler
            for handler in opener.handlers
            if isinstance(handler, AllowlistRedirectHandler)
        ]
        self.assertEqual(len(handlers), 1)


class CorridorRouteTests(unittest.TestCase):
    def test_list_sources_defaults_to_gb(self):
        from app.main import list_sources

        payload = list_sources()
        assert isinstance(payload, dict)
        self.assertEqual(payload["corridor"], "United Kingdom")
        self.assertEqual(payload["code"], "GB")
        self.assertEqual(len(payload["sources"]), 4)

    def test_list_sources_selects_a_profile(self):
        from app.main import list_sources

        payload = list_sources("sg")
        assert isinstance(payload, dict)
        self.assertEqual(payload["code"], "SG")
        self.assertEqual(payload["corridor"], "Singapore")
        self.assertTrue(len(payload["sources"]) > 4)
        for entry in payload["sources"]:
            for field in ("source_id", "label", "url", "category"):
                self.assertTrue(entry[field], field)

    def test_list_sources_rejects_unknown_profiles_with_400(self):
        from app.main import list_sources

        response = list_sources("XX")
        self.assertEqual(response.status_code, 400)

    def test_list_corridors_reports_status(self):
        from app.main import list_corridors

        payload = list_corridors()
        self.assertEqual(payload["default"], "GB")
        self.assertEqual(len(payload["corridors"]), 9)
        by_code = {entry["code"]: entry for entry in payload["corridors"]}
        self.assertEqual(by_code["HK"]["kind"], "jurisdiction")
        self.assertEqual(by_code["ID"]["kind"], "origin")
        self.assertEqual(by_code["SG"]["status"], "sources_verified")
        self.assertEqual(by_code["AU"]["status"], "partial")

    def test_retrieve_route_rejects_unknown_profiles_with_400(self):
        from app.main import RetrieveRequest, retrieve_official_sources

        response = retrieve_official_sources(
            RetrieveRequest(source_ids=None, queries=[], profile="XX")
        )
        self.assertEqual(response.status_code, 400)

    def test_retrieve_route_uses_the_profile_catalog(self):
        from unittest.mock import patch

        from app import main as main_module
        from app.main import RetrieveRequest, retrieve_official_sources

        with patch.object(
            main_module, "retrieve_sources", return_value=([], [])
        ) as mocked:
            response = retrieve_official_sources(
                RetrieveRequest(source_ids=["sg-mom"], queries=[], profile="SG")
            )
        self.assertEqual(response.status_code, 200)
        _, kwargs = mocked.call_args
        self.assertIn("sg-mom", kwargs["catalog"])
        self.assertNotIn("minimum-wage-rates", kwargs["catalog"])


if __name__ == "__main__":
    unittest.main()
