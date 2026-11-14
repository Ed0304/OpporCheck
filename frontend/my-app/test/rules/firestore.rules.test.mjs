// Firestore Security Rules tests (node:test, no extra framework).
//
// Run: npm run test:rules  (from frontend/my-app; boots the Firestore
// emulator via firebase.json at the repo root, then runs this file.)
// These tests assert server-side enforcement only. They do not test live
// Firebase Auth, production Firestore, or AI inference.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const RULES = readFileSync(join(ROOT, "firestore.rules"), "utf8");

const ALICE = "alice-uid";
const BOB = "bob-uid";

function validReport() {
  return {
    occupation: "Fruit Picker",
    employer: "Orchard Ltd",
    salary: "£12/hour",
    destination_country: "United Kingdom",
    employment_type: "seasonal",
    missing_information: ["contract terms"],
    concerns: [{ concern: "Fee requested", evidence: "pay £150", confidence: "high" }],
  };
}

function validDoc(ownerId) {
  return {
    ownerId,
    title: "Berry picking — United Kingdom",
    status: "reviewed",
    postingText: "Pick berries in Kent.",
    report: validReport(),
    inferenceSource: "in_cloud",
    latencyMs: 1200,
    cloudModel: "test-model",
    mode: "hybrid",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

// Explicit lifecycle (no hooks): init, then tests, then cleanup, in
// top-level await order. Each test starts from a cleared database.
const testEnv = await initializeTestEnvironment({
  projectId: "demo-oppcheck",
  firestore: { rules: RULES },
});

async function fresh() {
  await testEnv.clearFirestore();
}

function aliceDb() {
  return testEnv.authenticatedContext(ALICE).firestore();
}

function bobDb() {
  return testEnv.authenticatedContext(BOB).firestore();
}

function anonDb() {
  return testEnv.unauthenticatedContext().firestore();
}

async function seedAliceDoc(data = {}) {
  // Seed through Alice's own authenticated context (owner creation is
  // allowed by the rules), avoiding the rules-disabled admin context.
  const ref = await addDoc(collection(aliceDb(), "investigations"), {
    ...validDoc(ALICE),
    ...data,
  });
  return ref.id;
}

await test("unauthenticated reads and writes are denied", async () => {
  await fresh();
  const id = await seedAliceDoc();
  const db = anonDb();
  await assert.rejects(getDoc(doc(db, "investigations", id)), /permission-denied/i);
  await assert.rejects(getDocs(collection(db, "investigations")), /permission-denied/i);
  await assert.rejects(addDoc(collection(db, "investigations"), validDoc("anon")), /permission-denied/i);
  await assert.rejects(updateDoc(doc(db, "investigations", id), { title: "x" }), /permission-denied/i);
  await assert.rejects(deleteDoc(doc(db, "investigations", id)), /permission-denied/i);
});

await test("cross-user reads, updates, and deletes are denied", async () => {
  await fresh();
  const id = await seedAliceDoc();
  const db = bobDb();
  await assert.rejects(getDoc(doc(db, "investigations", id)), /permission-denied/i);
  await assert.rejects(updateDoc(doc(db, "investigations", id), { title: "hijacked" }), /permission-denied/i);
  await assert.rejects(deleteDoc(doc(db, "investigations", id)), /permission-denied/i);
});

await test("valid owner creation is allowed", async () => {
  await fresh();
  const db = aliceDb();
  const ref = await addDoc(collection(db, "investigations"), validDoc(ALICE));
  const snap = await getDoc(ref);
  assert.equal(snap.exists(), true);
  assert.equal(snap.data().ownerId, ALICE);
});

await test("creation with another UID is denied", async () => {
  await fresh();
  const db = aliceDb();
  await assert.rejects(
    addDoc(collection(db, "investigations"), validDoc(BOB)),
    /permission-denied/i,
  );
});

await test("invalid report schema is rejected", async () => {
  await fresh();
  const db = aliceDb();
  const badOccupation = validDoc(ALICE);
  delete badOccupation.report.occupation;
  await assert.rejects(addDoc(collection(db, "investigations"), badOccupation), /permission-denied/i);

  const badEnum = validDoc(ALICE);
  badEnum.report.employment_type = "gig";
  await assert.rejects(addDoc(collection(db, "investigations"), badEnum), /permission-denied/i);

  const badMissing = validDoc(ALICE);
  badMissing.report.missing_information = "none";
  await assert.rejects(addDoc(collection(db, "investigations"), badMissing), /permission-denied/i);

  const badTitle = validDoc(ALICE);
  badTitle.title = "";
  await assert.rejects(addDoc(collection(db, "investigations"), badTitle), /permission-denied/i);
});

await test("ownership and creation timestamp changes are rejected", async () => {
  await fresh();
  const id = await seedAliceDoc();
  const db = aliceDb();
  await assert.rejects(
    updateDoc(doc(db, "investigations", id), { ownerId: BOB }),
    /permission-denied/i,
  );
  await assert.rejects(
    updateDoc(doc(db, "investigations", id), { createdAt: Timestamp.now() }),
    /permission-denied/i,
  );
});

await test("title and status updates are allowed", async () => {
  await fresh();
  const id = await seedAliceDoc();
  const db = aliceDb();
  await updateDoc(doc(db, "investigations", id), {
    title: "Renamed investigation",
    updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "investigations", id), {
    status: "complete",
    updatedAt: serverTimestamp(),
  });
  const snap = await getDoc(doc(db, "investigations", id));
  assert.equal(snap.data().title, "Renamed investigation");
  assert.equal(snap.data().status, "complete");
});

await test("report and findings modifications are rejected", async () => {
  await fresh();
  const id = await seedAliceDoc();
  const db = aliceDb();
  const changed = validReport();
  changed.occupation = "Changed";
  await assert.rejects(
    updateDoc(doc(db, "investigations", id), { report: changed }),
    /permission-denied/i,
  );
  await assert.rejects(
    updateDoc(doc(db, "investigations", id), {
      findings: [{ claim: "x" }],
      updatedAt: serverTimestamp(),
    }),
    /permission-denied/i,
  );
  const withFindings = validDoc(ALICE);
  withFindings.findings = [{ claim: "x" }];
  await assert.rejects(
    addDoc(collection(db, "investigations"), withFindings),
    /permission-denied/i,
  );
});

await test("client-generated timestamps are rejected", async () => {
  await fresh();
  const db = aliceDb();
  const stamped = validDoc(ALICE);
  stamped.createdAt = Timestamp.now();
  stamped.updatedAt = Timestamp.now();
  await assert.rejects(addDoc(collection(db, "investigations"), stamped), /permission-denied/i);

  const id = await seedAliceDoc();
  await assert.rejects(
    updateDoc(doc(db, "investigations", id), {
      title: "Stamped",
      updatedAt: Timestamp.now(),
    }),
    /permission-denied/i,
  );
});

await test("unrecognized collection access is denied", async () => {
  await fresh();
  const db = aliceDb();
  await assert.rejects(getDoc(doc(db, "elsewhere", "x")), /permission-denied/i);
  await assert.rejects(setDoc(doc(db, "elsewhere", "x"), { a: 1 }), /permission-denied/i);
  const anon = anonDb();
  await assert.rejects(getDoc(doc(anon, "elsewhere", "x")), /permission-denied/i);
});

await testEnv.cleanup();
