// Backend auth header tests (node:test, no extra framework).
//
// Run: npm run test:unit  (from frontend/my-app.)
// Covers the centralized Firebase ID-token attachment: headers resolve
// per request, stay absent when signed out or failing, and reach the
// evidence-source client. Tokens are never stored anywhere.

import assert from "node:assert/strict";
import test from "node:test";
import {
  BACKEND_UNAUTHORIZED_MESSAGE,
  backendAuthHeaders,
  backendErrorMessage,
  registerBackendTokenProvider,
} from "../../src/lib/documents";
import { listOfficialSources, retrieveOfficialSources } from "../../src/lib/sources";

test("backendAuthHeaders is empty without a provider", async () => {
  registerBackendTokenProvider(null);
  assert.deepEqual(await backendAuthHeaders(), {});
});

test("backendAuthHeaders attaches Bearer tokens and swallows failures", async () => {
  try {
    registerBackendTokenProvider(async () => "tok-123");
    assert.deepEqual(await backendAuthHeaders(), {
      Authorization: "Bearer tok-123",
    });
    registerBackendTokenProvider(async () => null);
    assert.deepEqual(await backendAuthHeaders(), {});
    registerBackendTokenProvider(async () => {
      throw new Error("signed out mid-flight");
    });
    assert.deepEqual(await backendAuthHeaders(), {});
  } finally {
    registerBackendTokenProvider(null);
  }
});

test("401 responses map to the re-sign-in message", () => {
  assert.equal(
    backendErrorMessage(401, "Missing or malformed Authorization header.", "Upload failed."),
    BACKEND_UNAUTHORIZED_MESSAGE,
  );
  assert.match(BACKEND_UNAUTHORIZED_MESSAGE, /sign in again/);
  assert.equal(backendErrorMessage(400, "Too large.", "Upload failed."), "Too large.");
  assert.equal(backendErrorMessage(500, undefined, "Upload failed."), "Upload failed.");
  assert.equal(backendErrorMessage(null, undefined, "Fallback."), "Fallback.");
});

test("evidence-source 401 surfaces the re-sign-in message", async () => {
  const realFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: "Missing or malformed Authorization header." }),
    })) as unknown as typeof fetch;
    await assert.rejects(listOfficialSources("GB"), /sign in again/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("evidence-source 401 surfaces the Indonesian re-sign-in message", async () => {
  const realFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: "Missing or malformed Authorization header." }),
    })) as unknown as typeof fetch;
    await assert.rejects(listOfficialSources("GB", "id"), /masuk lagi/);
    await assert.rejects(retrieveOfficialSources([], [], "GB", "id"), /masuk lagi/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("evidence-source requests carry the Authorization header", async () => {
  const realFetch = globalThis.fetch;
  try {
    let seen: Record<string, string> = {};
    globalThis.fetch = (async (
      _url: unknown,
      init?: { headers?: Record<string, string> },
    ) => {
      seen = { ...(init?.headers ?? {}) };
      return {
        ok: true,
        status: 200,
        json: async () => ({ corridor: "Test", sources: [] }),
      };
    }) as typeof fetch;

    registerBackendTokenProvider(async () => "tok-abc");
    await listOfficialSources("GB");
    assert.equal(seen["Authorization"], "Bearer tok-abc");

    registerBackendTokenProvider(null);
    await listOfficialSources("GB");
    assert.equal(seen["Authorization"], undefined);
  } finally {
    globalThis.fetch = realFetch;
    registerBackendTokenProvider(null);
  }
});
