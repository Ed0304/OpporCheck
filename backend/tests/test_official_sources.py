"""Official-source retrieval tests (stdlib unittest, no network).

Run (from the backend/ directory):  python -m unittest discover -s tests

HTTP is scripted through a fake urllib handler, so no test touches the
network. These tests assert allowlist enforcement and retrieval behavior
only; they do not test live GOV.UK pages or Firebase integration.
"""

from __future__ import annotations

import io
import socket
import unittest
from email.message import Message
from urllib.error import HTTPError
from urllib.request import (
    BaseHandler,
    HTTPDefaultErrorHandler,
    HTTPErrorProcessor,
    OpenerDirector,
    UnknownHandler,
)
from urllib.response import addinfourl

from app.official_sources import (
    ALLOWLIST,
    ApprovedSource,
    MAX_RESPONSE_BYTES,
    retrieve_source,
    retrieve_sources,
    validate_allowlisted_url,
)


PAGE = """<!doctype html><html><head><title>National Minimum Wage rates</title>
<script>fetch('/evil');</script><style>body{color:red}</style></head>
<body><main>
<h1>National Minimum Wage rates</h1>
<p>The National Minimum Wage for workers aged 21 and over is &pound;12.21 per hour.</p>
<p>Agencies must never charge work-seekers a fee for finding them work in the United Kingdom.</p>
<p>Seasonal workers on farms need a certificate of sponsorship from a licensed scheme operator.</p>
</main></body></html>"""


def _response(
    url: str,
    body: bytes,
    content_type: str = "text/html; charset=utf-8",
    code: int = 200,
    msg: str = "OK",
):
    headers = Message()
    headers["Content-Type"] = content_type
    response = addinfourl(io.BytesIO(body), headers, url, code)
    response.msg = msg
    return response


def _redirect(url: str, target: str):
    headers = Message()
    headers["Location"] = target
    response = addinfourl(io.BytesIO(b""), headers, url, 302)
    response.msg = "Found"
    return response


class ScriptedHandler(BaseHandler):
    """Fake https handler: scripts redirects, errors, and bodies per URL."""

    handler_order = 100

    def __init__(self, script: dict):
        self.script = script

    def https_open(self, req):
        url = req.get_full_url()
        action = self.script.get(url, ("body", PAGE.encode("utf-8")))
        kind = action[0]
        if kind == "body":
            _, body = action
            return _response(url, body)
        if kind == "content-type":
            _, content_type, body = action
            return _response(url, body, content_type)
        if kind == "redirect":
            _, target = action
            return _redirect(url, target)
        if kind == "http-error":
            _, code = action
            raise HTTPError(url, code, "Error", Message(), None)
        if kind == "timeout":
            raise socket.timeout("timed out")
        raise AssertionError(f"unknown script action: {kind}")


def scripted_opener(script: dict):
    """Mirrors the production opener composition, with scripted HTTPS."""
    from app.official_sources import AllowlistRedirectHandler

    opener = OpenerDirector()
    opener.add_handler(ScriptedHandler(script))
    opener.add_handler(UnknownHandler())
    opener.add_handler(HTTPDefaultErrorHandler())
    opener.add_handler(HTTPErrorProcessor())
    opener.add_handler(AllowlistRedirectHandler())
    return opener


def entry(url: str = "https://www.gov.uk/national-minimum-wage-rates") -> ApprovedSource:
    return ApprovedSource(
        id="minimum-wage-rates",
        label="Minimum wage rates (test)",
        url=url,
        category="pay-rates",
    )


class AllowlistTests(unittest.TestCase):
    def test_allowlist_matches_the_approved_corridor_pages(self):
        self.assertEqual(
            [source.url for source in ALLOWLIST],
            [
                "https://www.gov.uk/seasonal-worker-visa",
                "https://www.gov.uk/agency-workers-your-rights/fees",
                "https://www.gov.uk/guidance/seasonal-work-on-farms-guidance-for-workers",
                "https://www.gov.uk/national-minimum-wage-rates",
            ],
        )

    def test_unapproved_domains_are_rejected(self):
        for url in (
            "https://evil-example.com/national-minimum-wage-rates",
            "https://gov-uk.example.com/seasonal-worker-visa",
            "https://www.gov.uk.evil-example.com/seasonal-worker-visa",
        ):
            with self.assertRaises(ValueError, msg=url):
                validate_allowlisted_url(url)

    def test_unapproved_paths_and_schemes_are_rejected(self):
        for url in (
            "http://www.gov.uk/seasonal-worker-visa",
            "https://www.gov.uk/some-other-page",
            "https://www.gov.uk/seasonal-worker-visa/eligibility",
            "https://www.gov.uk/",
            "not-a-url",
            "",
        ):
            with self.assertRaises(ValueError, msg=url):
                validate_allowlisted_url(url)

    def test_unknown_source_ids_are_rejected(self):
        with self.assertRaises(ValueError):
            retrieve_sources(["no-such-source"], [])


class RetrievalTests(unittest.TestCase):
    def test_success_returns_title_url_timestamp_and_excerpts(self):
        source, failure = retrieve_source(
            entry(), [], opener=scripted_opener({})
        )
        self.assertIsNone(failure)
        self.assertIsNotNone(source)
        assert source is not None
        self.assertEqual(source.url, entry().url)
        self.assertEqual(source.title, "National Minimum Wage rates")
        self.assertTrue(source.retrieved_at)
        self.assertGreater(len(source.excerpts), 0)
        for excerpt in source.excerpts:
            self.assertIn(excerpt.text, PAGE.replace("&pound;", "£"))

    def test_scripts_are_not_executed_or_leaked_into_text(self):
        source, _ = retrieve_source(entry(), [], opener=scripted_opener({}))
        assert source is not None
        joined = " ".join(excerpt.text for excerpt in source.excerpts)
        self.assertNotIn("fetch('/evil')", joined)
        self.assertNotIn("color:red", joined)

    def test_query_terms_select_relevant_excerpts(self):
        source, _ = retrieve_source(
            entry(),
            ["Can agencies charge a fee for finding work?"],
            opener=scripted_opener({}),
        )
        assert source is not None
        self.assertIn("fee", source.excerpts[0].text)

    def test_http_errors_become_per_source_failures(self):
        url = entry().url
        _, failure = retrieve_source(
            entry(), [], opener=scripted_opener({url: ("http-error", 503)})
        )
        self.assertIsNone(_)
        self.assertIsNotNone(failure)
        assert failure is not None
        self.assertIn("503", failure.error)

    def test_timeouts_become_per_source_failures(self):
        url = entry().url
        _, failure = retrieve_source(
            entry(), [], opener=scripted_opener({url: ("timeout",)})
        )
        self.assertIsNotNone(failure)
        assert failure is not None
        self.assertIn("timed out", failure.error.lower())

    def test_oversize_responses_are_rejected(self):
        url = entry().url
        big = b"<html><body><p>" + b"x" * (MAX_RESPONSE_BYTES + 10) + b"</p></body></html>"
        _, failure = retrieve_source(
            entry(), [], opener=scripted_opener({url: ("body", big)})
        )
        self.assertIsNotNone(failure)
        assert failure is not None
        self.assertIn("too large", failure.error.lower())

    def test_non_html_responses_are_rejected(self):
        url = entry().url
        _, failure = retrieve_source(
            entry(),
            [],
            opener=scripted_opener(
                {url: ("content-type", "application/pdf", b"%PDF-1.4 fake")}
            ),
        )
        self.assertIsNotNone(failure)

    def test_pages_without_readable_text_are_rejected(self):
        url = entry().url
        _, failure = retrieve_source(
            entry(), [], opener=scripted_opener({url: ("body", b"<html></html>")})
        )
        self.assertIsNotNone(failure)

    def test_redirects_outside_the_allowlist_are_rejected(self):
        url = entry().url
        _, failure = retrieve_source(
            entry(),
            [],
            opener=scripted_opener({url: ("redirect", "https://evil-example.com/clone")}),
        )
        self.assertIsNotNone(failure)
        assert failure is not None
        self.assertIn("allowlist", failure.error.lower())

    def test_redirects_to_other_allowlisted_pages_are_followed(self):
        first = "https://www.gov.uk/seasonal-worker-visa"
        _, failure = retrieve_source(
            ApprovedSource(id="x", label="x", url=first, category="visa-route"),
            [],
            opener=scripted_opener({first: ("redirect", entry().url)}),
        )
        self.assertIsNone(failure)

    def test_batch_retrieval_isolates_failures(self):
        good = ALLOWLIST[0]
        bad = ALLOWLIST[1]
        sources, failures = retrieve_sources(
            [good.id, bad.id],
            [],
            opener=scripted_opener({bad.url: ("http-error", 500)}),
        )
        self.assertEqual([source.source_id for source in sources], [good.id])
        self.assertEqual([failure.source_id for failure in failures], [bad.id])


class RoutesTests(unittest.TestCase):
    def test_list_sources_returns_the_catalog(self):
        from app.main import list_sources

        payload = list_sources()
        self.assertEqual(payload["corridor"], "United Kingdom")
        self.assertEqual(len(payload["sources"]), 4)
        for entry in payload["sources"]:
            for field in ("source_id", "label", "url", "category"):
                self.assertTrue(entry[field], field)

    def test_retrieve_route_rejects_unknown_ids_with_400(self):
        from app.main import RetrieveRequest, retrieve_official_sources

        response = retrieve_official_sources(
            RetrieveRequest(source_ids=["no-such-source"], queries=[])
        )
        self.assertEqual(response.status_code, 400)

    def test_retrieve_route_shapes_service_results(self):
        import json
        from unittest.mock import patch

        from app import main as main_module
        from app.main import RetrieveRequest, retrieve_official_sources
        from app.official_sources import Excerpt, RetrievedSource, SourceFailure

        with patch.object(
            main_module,
            "retrieve_sources",
            return_value=(
                [
                    RetrievedSource(
                        source_id="minimum-wage-rates",
                        title="Minimum wage",
                        url="https://www.gov.uk/national-minimum-wage-rates",
                        retrieved_at="2026-11-15T00:00:00+00:00",
                        excerpts=(Excerpt(text="Rate info.", truncated=False),),
                    )
                ],
                [
                    SourceFailure(
                        source_id="seasonal-worker-visa",
                        url="https://www.gov.uk/seasonal-worker-visa",
                        error="Timed out.",
                    )
                ],
            ),
        ):
            response = retrieve_official_sources(
                RetrieveRequest(source_ids=None, queries=["pay rate?"])
            )
        self.assertEqual(response.status_code, 200)
        payload = json.loads(response.body.decode("utf-8"))
        self.assertEqual(len(payload["sources"]), 1)
        self.assertEqual(payload["sources"][0]["source_id"], "minimum-wage-rates")
        self.assertEqual(len(payload["errors"]), 1)
        self.assertEqual(payload["errors"][0]["source_id"], "seasonal-worker-visa")


if __name__ == "__main__":
    unittest.main()
