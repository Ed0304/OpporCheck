"""Official-source retrieval for evidence investigation (UK corridor).

Only the explicitly approved GOV.UK pages below may be fetched. Callers
select sources by catalog id; arbitrary user-supplied URLs are never
accepted, and redirects are followed only while every hop stays inside
the allowlist. Pages are parsed as inert HTML (no scripts execute) and
returned as short excerpts with title, URL, and retrieval timestamp —
never as full pages.
"""

from __future__ import annotations

import re
import socket
from dataclasses import dataclass
from datetime import datetime, timezone
from html.parser import HTMLParser
from typing import Optional
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlsplit
from urllib.request import (
    HTTPRedirectHandler,
    HTTPDefaultErrorHandler,
    HTTPErrorProcessor,
    HTTPSHandler,
    OpenerDirector,
    Request,
    UnknownHandler,
)

CORRIDOR = "United Kingdom"

ALLOWED_HOST = "www.gov.uk"
ALLOWED_SCHEME = "https"

FETCH_TIMEOUT_SECONDS = 10.0
MAX_RESPONSE_BYTES = 512 * 1024  # 512 KB; official pages are far smaller
MAX_REDIRECTS = 5
MAX_EXCERPTS = 3
MAX_EXCERPT_CHARS = 600
# Matches the RetrieveRequest queries cap (and the frontend planner's
# 12-item cap): every accepted query is used for excerpt ranking.
MAX_QUERIES = 12
MAX_QUERY_CHARS = 500
MIN_BLOCK_CHARS = 30


@dataclass(frozen=True)
class ApprovedSource:
    id: str
    label: str
    url: str
    category: str


# The full retrieval universe. Labels are OpporCheck's own descriptions;
# the page-supplied <title> is returned separately with each retrieval.
ALLOWLIST: tuple[ApprovedSource, ...] = (
    ApprovedSource(
        id="seasonal-worker-visa",
        label="Seasonal Worker visa (GOV.UK overview)",
        url="https://www.gov.uk/seasonal-worker-visa",
        category="visa-route",
    ),
    ApprovedSource(
        id="agency-worker-fees",
        label="Agency workers: fees (GOV.UK)",
        url="https://www.gov.uk/agency-workers-your-rights/fees",
        category="worker-rights-and-fees",
    ),
    ApprovedSource(
        id="seasonal-farm-guidance",
        label="Seasonal work on farms: guidance for workers (GOV.UK)",
        url="https://www.gov.uk/guidance/seasonal-work-on-farms-guidance-for-workers",
        category="seasonal-guidance",
    ),
    ApprovedSource(
        id="minimum-wage-rates",
        label="National Minimum Wage rates (GOV.UK)",
        url="https://www.gov.uk/national-minimum-wage-rates",
        category="pay-rates",
    ),
)

_BY_ID = {source.id: source for source in ALLOWLIST}
_ALLOWLISTED_URLS = {source.url for source in ALLOWLIST}


@dataclass(frozen=True)
class Excerpt:
    text: str
    truncated: bool


@dataclass(frozen=True)
class RetrievedSource:
    source_id: str
    title: str
    url: str
    retrieved_at: str
    excerpts: tuple[Excerpt, ...]


@dataclass(frozen=True)
class SourceFailure:
    source_id: str
    url: str
    error: str


class SourceError(Exception):
    """User-facing retrieval problem for one source."""


def _normalize_path(path: str) -> str:
    return path.rstrip("/") or "/"


def _match_key(parts) -> tuple[str, str | None, str, str]:
    """Identity of an allowlisted page: scheme, host, path, and query.

    The query is compared so that two approved pages sharing a path
    (e.g. statute URLs differing by article parameter) stay distinct.
    Trailing slashes never distinguish pages.
    """
    return (
        parts.scheme,
        parts.hostname,
        _normalize_path(parts.path),
        parts.query or "",
    )


def validate_allowlisted_url(
    url: str, allowed_urls: Optional[list[str]] = None
) -> str:
    """Return the URL when it exactly matches an allowlisted page.

    Raises ValueError for anything else: wrong scheme, wrong host,
    unknown path or query, or malformed input. Comparison is exact
    (modulo a trailing slash) so lookalike hosts and sibling paths
    cannot pass. allowed_urls defaults to the GB corridor set.
    """
    universe = (
        list(allowed_urls) if allowed_urls is not None else sorted(_ALLOWLISTED_URLS)
    )
    try:
        parts = urlsplit(url.strip())
    except ValueError as exc:
        raise ValueError(f'"{url}" is not a valid URL.') from exc
    if parts.scheme != ALLOWED_SCHEME or parts.username or parts.fragment:
        raise ValueError(f'"{url}" is not an approved official source.')
    wanted = _match_key(parts)
    for allowed in universe:
        if _match_key(urlsplit(allowed)) == wanted:
            return allowed
    raise ValueError(f'"{url}" is not an approved official source.')


class AllowlistRedirectHandler(HTTPRedirectHandler):
    """Follows redirects only while every hop stays inside the allowlist."""

    def __init__(self, allowed_urls: Optional[list[str]] = None) -> None:
        super().__init__()
        self._allowed_urls = allowed_urls

    def redirect_request(  # type: ignore[override]
        self, req, fp, code, msg, headers, newurl
    ) -> Optional[Request]:
        count = getattr(req, "_oppcheck_redirects", 0) + 1
        if count > MAX_REDIRECTS:
            raise SourceError("The source redirected too many times. Giving up.")
        target = urljoin(req.get_full_url(), newurl)
        try:
            validate_allowlisted_url(target, self._allowed_urls)
        except ValueError:
            raise SourceError(
                "The source redirected outside the approved official-source list. "
                "Redirects are never followed off the allowlist."
            ) from None
        # Pass the joined absolute URL on: a relative Location is
        # validated against the allowlist above, then followed safely.
        redirect = super().redirect_request(req, fp, code, msg, headers, target)
        if redirect is not None:
            setattr(redirect, "_oppcheck_redirects", count)
        return redirect


def build_retrieval_opener(
    allowed_urls: Optional[list[str]] = None,
) -> OpenerDirector:
    """Opener with exactly the handlers retrieval needs.

    Built explicitly (never build_opener with defaults): the default
    opener set includes a stock redirect follower that would chase
    redirects off the allowlist before ours runs.
    """

    opener = OpenerDirector()
    opener.add_handler(UnknownHandler())
    opener.add_handler(HTTPDefaultErrorHandler())
    opener.add_handler(HTTPErrorProcessor())
    opener.add_handler(HTTPSHandler())
    opener.add_handler(AllowlistRedirectHandler(allowed_urls))
    return opener


class _ReadableTextParser(HTMLParser):
    """Collects <title> and readable text blocks; scripts never execute."""

    _BLOCK_TAGS = {"p", "li", "h1", "h2", "h3", "h4", "blockquote", "td", "dd"}
    _SKIP_TAGS = {"script", "style", "noscript", "template"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title_parts: list[str] = []
        self.headings: list[str] = []
        self.blocks: list[str] = []
        self._current: list[str] = []
        self._in_title = False
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag in self._SKIP_TAGS:
            self._skip_depth += 1
        if self._skip_depth:
            return
        if tag == "title":
            self._in_title = True
        if tag in self._BLOCK_TAGS:
            self._flush_current()

    def handle_endtag(self, tag: str) -> None:
        if tag in self._SKIP_TAGS and self._skip_depth:
            self._skip_depth -= 1
            return
        if self._skip_depth:
            return
        if tag == "title":
            self._in_title = False
        if tag in self._BLOCK_TAGS:
            self._flush_current()

    def handle_data(self, data: str) -> None:
        if self._skip_depth:
            return
        if self._in_title:
            self.title_parts.append(data)
        else:
            self._current.append(data)

    def _flush_current(self) -> None:
        text = " ".join("".join(self._current).split())
        self._current = []
        if len(text) >= MIN_BLOCK_CHARS:
            self.blocks.append(text)

    def result(self) -> tuple[str, str, list[str]]:
        self._flush_current()
        title = " ".join("".join(self.title_parts).split())
        return title, self.blocks[0] if self.blocks else "", self.blocks


_STOPWORDS = frozenset(
    "what does the official say about workers worker should check before this that "
    "with from have has are was were will would there their they them then than "
    "and for can who whom whose which your you our its into over under does did "
    "how when where why not any all per each other such than too very".split()
)


def _query_terms(queries: list[str]) -> set[str]:
    terms: set[str] = set()
    for query in queries[:MAX_QUERIES]:
        for word in re.findall(r"[a-z0-9']+", query.lower()):
            cleaned = word.strip("'")
            if len(cleaned) > 3 and cleaned not in _STOPWORDS:
                terms.add(cleaned)
    return terms


def _truncate_at_word(text: str, limit: int) -> tuple[str, bool]:
    if len(text) <= limit:
        return text, False
    cut = text[:limit].rsplit(" ", 1)[0].strip()
    return (cut if cut else text[:limit]), True


def select_excerpts(blocks: list[str], queries: list[str]) -> list[Excerpt]:
    """Picks the most query-relevant blocks; prefixes stay verbatim substrings."""
    terms = _query_terms(queries)

    def score(block: str) -> int:
        lowered = block.lower()
        return sum(1 for term in terms if term in lowered)

    ranked = sorted(enumerate(blocks), key=lambda pair: (-score(pair[1]), pair[0]))
    chosen = [block for _, block in ranked[:MAX_EXCERPTS] if block.strip()]
    excerpts: list[Excerpt] = []
    for block in chosen:
        text, truncated = _truncate_at_word(block, MAX_EXCERPT_CHARS)
        excerpts.append(Excerpt(text=text, truncated=truncated))
    return excerpts


def _decode_body(data: bytes, content_type: str) -> str:
    match = re.search(r"charset=([\w-]+)", content_type, re.IGNORECASE)
    encoding = match.group(1) if match else "utf-8"
    try:
        return data.decode(encoding, errors="replace")
    except (LookupError, UnicodeError):
        return data.decode("utf-8", errors="replace")


def fetch_page(
    url: str,
    opener: Optional[OpenerDirector] = None,
    timeout: float = FETCH_TIMEOUT_SECONDS,
    allowed_urls: Optional[list[str]] = None,
) -> tuple[str, str]:
    """Fetches one allowlisted page; returns (final_url, html)."""
    canonical = validate_allowlisted_url(url, allowed_urls)
    active = opener if opener is not None else build_retrieval_opener(allowed_urls)
    request = Request(canonical, headers={"User-Agent": "OpporCheck-evidence/1.0"})
    try:
        response = active.open(request, timeout=timeout)
    except SourceError:
        raise
    except HTTPError as exc:
        raise SourceError(
            f"The official source is unavailable (HTTP {exc.code}). Try again later."
        ) from exc
    except (socket.timeout, TimeoutError) as exc:
        raise SourceError(
            "The official source timed out. Try again later."
        ) from exc
    except URLError as exc:
        raise SourceError(
            f"The official source could not be reached ({exc.reason}). Try again later."
        ) from exc
    with response:
        final_url = response.geturl()
        # Re-validate: the handler chain should already guarantee this.
        validate_allowlisted_url(final_url, allowed_urls)
        content_type = response.headers.get("Content-Type", "")
        if "text/html" not in content_type.lower():
            raise SourceError(
                "The official source did not return a readable page. Try again later."
            )
        data = response.read(MAX_RESPONSE_BYTES + 1)
    if len(data) > MAX_RESPONSE_BYTES:
        raise SourceError(
            "The official source page is too large to check safely. Try again later."
        )
    return final_url, _decode_body(data, content_type)


def retrieve_source(
    entry: ApprovedSource,
    queries: list[str],
    opener: Optional[OpenerDirector] = None,
    allowed_urls: Optional[list[str]] = None,
) -> tuple[Optional[RetrievedSource], Optional[SourceFailure]]:
    """Retrieves one catalog source; never raises for per-source problems."""
    trimmed_queries = [query[:MAX_QUERY_CHARS] for query in queries[:MAX_QUERIES]]
    try:
        _, html = fetch_page(entry.url, opener=opener, allowed_urls=allowed_urls)
    except (SourceError, ValueError) as exc:
        return None, SourceFailure(source_id=entry.id, url=entry.url, error=str(exc))
    parser = _ReadableTextParser()
    try:
        parser.feed(html)
    except Exception as exc:
        return (
            None,
            SourceFailure(
                source_id=entry.id,
                url=entry.url,
                error=f"The official source page could not be read ({exc}).",
            ),
        )
    title, first_block, blocks = parser.result()
    excerpts = select_excerpts(blocks, trimmed_queries)
    if not excerpts:
        return (
            None,
            SourceFailure(
                source_id=entry.id,
                url=entry.url,
                error="The official source page contained no readable text.",
            ),
        )
    return (
        RetrievedSource(
            source_id=entry.id,
            title=title or first_block[:120],
            url=entry.url,
            retrieved_at=datetime.now(timezone.utc).isoformat(),
            excerpts=tuple(excerpts),
        ),
        None,
    )


def retrieve_sources(
    source_ids: Optional[list[str]],
    queries: list[str],
    opener: Optional[OpenerDirector] = None,
    catalog: Optional[dict[str, ApprovedSource]] = None,
    allowed_urls: Optional[list[str]] = None,
) -> tuple[list[RetrievedSource], list[SourceFailure]]:
    """Retrieves catalog sources by id; unknown ids raise ValueError.

    catalog and allowed_urls default to the GB corridor set; corridor
    callers pass their own profile's set.
    """
    by_id = catalog if catalog is not None else _BY_ID
    ids = list(by_id) if source_ids is None else source_ids
    unknown = [source_id for source_id in ids if source_id not in by_id]
    if unknown:
        valid = ", ".join(sorted(by_id))
        raise ValueError(f"Unknown official source id(s): {', '.join(unknown)}. Valid: {valid}.")
    sources: list[RetrievedSource] = []
    failures: list[SourceFailure] = []
    for source_id in ids:
        source, failure = retrieve_source(
            by_id[source_id], queries, opener=opener, allowed_urls=allowed_urls
        )
        if source is not None:
            sources.append(source)
        if failure is not None:
            failures.append(failure)
    return sources, failures


def catalog() -> list[dict[str, str]]:
    """The approved-source catalog: ids, labels, URLs, and categories."""
    return [
        {
            "source_id": source.id,
            "label": source.label,
            "url": source.url,
            "category": source.category,
        }
        for source in ALLOWLIST
    ]


# Re-exported for tests that script urllib at the handler level.
__all__ = [
    "ALLOWLIST",
    "AllowlistRedirectHandler",
    "ApprovedSource",
    "CORRIDOR",
    "build_retrieval_opener",
    "Excerpt",
    "MAX_RESPONSE_BYTES",
    "RetrievedSource",
    "SourceError",
    "SourceFailure",
    "catalog",
    "fetch_page",
    "retrieve_source",
    "retrieve_sources",
    "select_excerpts",
    "validate_allowlisted_url",
]
