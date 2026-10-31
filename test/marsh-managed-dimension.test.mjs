import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  EMPTY_WITNESS_ROOT, identifyJsonSemanticContent, decodeSemanticEnvelope,
  admitJsonSemanticContent,
} from "@red-cup-engineering/computer-data-engineering-services-section/semiotic-expression-notation/semantic-content-identity";
import {
  induceCapabilityRepairDemand, inducePrivateLiveMudDemand, PRIVATE_LIVE_MUD_REQUIREMENTS,
} from "@red-cup-engineering/semiotic-exchange-chain-services-section/semiotic-exchange-demand-induction";
import {
  createModeledUnionDimension, createCarrierAdmissionReceipt, createWorkCarrier,
  MARSH_EXCHANGE_PROFILE, MARSH_EXCHANGE_PROFILE_ID, LEGACY_EXCHANGE_PROFILE,
} from "../src/index.mjs";

// Derived from the frozen managed profile and the source-free Dimension work
// order. Changed implementation was not read to derive these assertions.
// Canonical EVM identities/heads/evidence below use an independent CBOR encoder
// and Node SHA256. Data is the original supplier for canonical SEN carriers.
// Readiness receipt fixtures added below test consistency, not cryptography.
const PROFILE = "marsh:exchange:v1";
const PROFILE_ID = "0x47eada871a98e7139b3f118a26b4e82995d0ed01552733b2cd99e6de4cf03044";
const CHAIN = "eip155:31337", HUB = "0x000000000000000000000000000000000000beef";
const PROVIDER = "0x1111111111111111111111111111111111111111";
const REQUESTER = "0x2222222222222222222222222222222222222222";
const OTHER = "0x3333333333333333333333333333333333333333";
const hex = (bytes) => `0x${Buffer.from(bytes).toString("hex")}`;
const raw = (value) => Buffer.from(value.slice(2), "hex");
const sha = (bytes) => hex(createHash("sha256").update(bytes).digest());
const ni = (bytes) => `ni:///sha-256;${createHash("sha256").update(bytes).digest("base64url")}`;
const Z = `0x${"00".repeat(32)}`, L = `0x${"22".repeat(32)}`, G = `0x${"33".repeat(32)}`;
function head(major, input) {
  const n = BigInt(input), prefix = major << 5;
  if (n < 24n) return Buffer.from([prefix | Number(n)]);
  for (const [width, tag] of [[1, 24], [2, 25], [4, 26], [8, 27]]) if (n < 1n << BigInt(8 * width)) {
    const out = Buffer.alloc(width + 1); out[0] = prefix | tag;
    for (let i = 0; i < width; ++i) out[width - i] = Number(n >> BigInt(i * 8) & 255n);
    return out;
  }
  throw new Error("independent CBOR uint exceeds 64 bits");
}
function cbor(value) {
  if (Array.isArray(value)) return Buffer.concat([head(4, value.length), ...value.map(cbor)]);
  if (typeof value === "string") { const b = Buffer.from(value); return Buffer.concat([head(3, b.length), b]); }
  if (typeof value === "boolean") return Buffer.from([value ? 245 : 244]);
  if (typeof value === "number" || typeof value === "bigint") return head(0, value);
  if (value instanceof Uint8Array) return Buffer.concat([head(2, value.length), value]);
  throw new Error("unadmitted independent oracle term");
}
const hash = (value) => sha(cbor(value));
function resource(controller, kind, subject) {
  return sha(Buffer.concat([Buffer.from([163]), cbor("object"), cbor(`evm:${controller}`), cbor("subject"), cbor(subject), cbor("predicate"), cbor(kind)]));
}
const cellState = (carrier, law, retired) => hash(["marsh:exchange-cell-state:v1", raw(carrier), raw(law), retired]);
const demandState = (carrier, grounding, law, phase, offer = Z, cell = Z, result = Z, receipt = Z) => hash(["marsh:exchange-demand-state:v1", raw(carrier), raw(grounding), raw(law), phase, raw(offer), raw(cell), raw(result), raw(receipt)]);
const offerState = (carrier, demand, cell) => hash(["marsh:exchange-offer-state:v1", raw(carrier), raw(demand), raw(cell)]);
const receiptDigest = ({ resource, actor, move, content, priorContent = Z, priorSequence = "0", carrierId = Z }) => hash(["marsh:exchange-receipt:v1", `${CHAIN}:${HUB}`, raw(resource), `evm:${actor}`, move, raw(priorContent), BigInt(priorSequence), raw(content), raw(carrierId)]);
const position = (number, logIndex) => ({ blockNumber: String(number), blockHash: sha(Buffer.from(`block:${number}`)), transactionHash: sha(Buffer.from(`transaction:${number}`)), transactionIndex: 0, logIndex });
const canonical = (objectKind, value) => identifyJsonSemanticContent({ objectKind, value, witnessRoot: EMPTY_WITNESS_ROOT });
function material(type, value) {
  const identified = canonical(`semiotic-exchange.${type}`, value);
  return { carrier: { type, value }, bytes: identified.bytes, contentNi: identified.token, digest: sha(identified.bytes) };
}
function originalDemand(induction) {
  const decoded = decodeSemanticEnvelope(induction.demandBytes, induction.demandNi);
  const objectKind = decoded.envelope.objectKind;
  assert.ok(objectKind.startsWith("semiotic-exchange."));
  const admitted = admitJsonSemanticContent({ bytes: induction.demandBytes, token: induction.demandNi, objectKind });
  return { carrier: { type: objectKind.slice("semiotic-exchange.".length), value: admitted.value }, bytes: induction.demandBytes, contentNi: induction.demandNi, digest: sha(induction.demandBytes) };
}
const admission = (m) => createCarrierAdmissionReceipt({ carrier: m.carrier, canonicalBytes: m.bytes, contentNi: m.contentNi, protocolVerificationReceiptNis: [ni(Buffer.from(`protocol:${m.carrier.type}`))] });
function event({ kind, number, resource: id, controller, role, subject, content, priorContent = Z, priorSequence = "0", actor = controller, move, carrier, ...fields }) {
  const sequence = String(BigInt(priorSequence) + 1n);
  const state = { resource: id, controller, kind: hash(role), content, evidence: receiptDigest({ resource: id, actor, move, content, priorContent, priorSequence, carrierId: carrier?.digest ?? Z }), sequence, priorContent, priorSequence };
  if (subject !== undefined) Object.assign(state, { subjectTerm: hex(cbor(subject)), kindTerm: hex(cbor(role)) });
  return {
    profile: PROFILE, profileId: PROFILE_ID, chainId: CHAIN, exchange: HUB,
    kind, chainPosition: position(number, 1), nativePosition: position(number, 0), resourceState: state,
    ...fields, ...(subject === undefined ? { sequence } : {}),
    ...(carrier ? { carrierId: carrier.digest, carrierHex: hex(carrier.bytes), carrierNi: carrier.contentNi } : {}),
  };
}
function fixture({ requester = REQUESTER, law = L, grounding = G, demandMaterial, retirementBeforeSelection = false } = {}) {
  const materials = {
    cell: material("SemioticExchangeCellCarrier", { type: "SemioticExchangeCellCarrier", service: "one capability" }),
    demand: demandMaterial ?? material("SemioticExchangeDemandCarrier", { type: "SemioticExchangeDemandCarrier", objective: "receive one exact result" }),
    offer: material("SemioticExchangeOfferCarrier", { type: "SemioticExchangeOfferCarrier", promise: "perform one request" }),
    result: material("SemioticExchangeResultCarrier", { type: "SemioticExchangeResultCarrier", result: "provider report" }),
    receipt: material("SemioticExchangeReceiptCarrier", { type: "SemioticExchangeReceiptCarrier", acceptance: "requester received exact result" }),
  };
  const subjectCell = ["marsh:exchange-cell:v1", raw(materials.cell.digest), raw(law)];
  const subjectDemand = ["marsh:exchange-demand:v1", raw(materials.demand.digest), raw(grounding), raw(law)];
  const cell = resource(PROVIDER, "Actor", subjectCell), demand = resource(requester, "Work", subjectDemand);
  const subjectOffer = ["marsh:exchange-offer:v1", raw(materials.offer.digest), raw(demand), raw(cell)];
  const offer = resource(PROVIDER, "Relation", subjectOffer);
  const heads = {
    active: cellState(materials.cell.digest, law, false), retired: cellState(materials.cell.digest, law, true),
    open: demandState(materials.demand.digest, grounding, law, 0),
    selected: demandState(materials.demand.digest, grounding, law, 1, offer, cell),
    submitted: demandState(materials.demand.digest, grounding, law, 2, offer, cell, materials.result.digest),
    received: demandState(materials.demand.digest, grounding, law, 3, offer, cell, materials.result.digest, materials.receipt.digest),
    offer: offerState(materials.offer.digest, demand, cell),
  };
  const descriptions = [
    { kind: "CellSeated", resource: cell, controller: PROVIDER, role: "Actor", subject: subjectCell, content: heads.active, move: 0, carrier: materials.cell, cell, law },
    { kind: "DemandRaised", resource: demand, controller: requester, role: "Work", subject: subjectDemand, content: heads.open, move: 2, carrier: materials.demand, demand, raiser: requester, wantedLaw: law, grounding },
    { kind: "DemandOffered", resource: offer, controller: PROVIDER, role: "Relation", subject: subjectOffer, content: heads.offer, move: 3, carrier: materials.offer, demand, offer, cell },
    { kind: "PurchaseMoved", resource: demand, controller: requester, role: "Work", content: heads.selected, priorContent: heads.open, priorSequence: "1", move: 4, demand, offer, cell, raiser: requester, providerController: PROVIDER },
    { kind: "CellRetired", resource: cell, controller: PROVIDER, role: "Actor", content: heads.retired, priorContent: heads.active, priorSequence: "1", move: 1, cell },
    { kind: "DemandResultSubmitted", resource: demand, controller: requester, role: "Work", actor: PROVIDER, content: heads.submitted, priorContent: heads.selected, priorSequence: "2", move: 5, carrier: materials.result, demand, offer, cell, result: materials.result.digest, providerController: PROVIDER },
    { kind: "DemandReceived", resource: demand, controller: requester, role: "Work", content: heads.received, priorContent: heads.submitted, priorSequence: "3", move: 6, carrier: materials.receipt, demand, offer, raiser: requester, result: materials.result.digest, receipt: materials.receipt.digest },
  ];
  if (retirementBeforeSelection) [descriptions[3], descriptions[4]] = [descriptions[4], descriptions[3]];
  const events = descriptions.map((description, index) => {
    const e = event({ ...description, number: 12 + index });
    // Native Work controller and provider caller are different coordinates.
    if (["CellSeated", "CellRetired", "DemandOffered"].includes(e.kind)) e.controller = PROVIDER;
    if (description.providerController) { e.controller = description.providerController; delete e.providerController; }
    return e;
  });
  return { materials, heads, cell, demand, offer, requester, law, grounding, events };
}
const create = (events, options = {}) => createModeledUnionDimension({ events, profile: PROFILE, chainId: CHAIN, exchange: HUB, ...options });
const demandLocus = (model, f) => model.presentation().loci.find((locus) => locus.type === "SemioticDemandLocus" && locus.id === f.demand);

test("managed profile is explicit or inferred while an empty unspecified model remains legacy", () => {
  assert.equal(MARSH_EXCHANGE_PROFILE, PROFILE); assert.equal(MARSH_EXCHANGE_PROFILE_ID, PROFILE_ID);
  assert.equal(LEGACY_EXCHANGE_PROFILE, "legacy:semiotic-exchange:v1");
  const inferred = createModeledUnionDimension({ events: fixture().events, chainId: CHAIN, exchange: HUB }).presentation();
  assert.equal(inferred.ledger.profile, PROFILE); assert.equal(inferred.ledger.profileId, PROFILE_ID);
  assert.equal(create([], {}).presentation().ledger.profile, PROFILE);
  assert.equal(createModeledUnionDimension({ events: [], chainId: CHAIN, exchange: HUB }).presentation().ledger.profile, LEGACY_EXCHANGE_PROFILE);
});

test("independently derived full history preserves governed Work, raw carrier and explicit receiving", () => {
  const f = fixture(), model = create(f.events), locus = demandLocus(model, f), p = model.presentation();
  assert.equal(locus.phase, "Received"); assert.equal(locus.carrierId, f.materials.demand.digest);
  assert.notEqual(locus.id, locus.carrierId); assert.equal(locus.resourceState.resource, f.demand);
  assert.equal(locus.resourceState.sequence, "4"); assert.equal(locus.resourceState.content, f.heads.received);
  assert.deepEqual(locus.submission, f.events[5]); assert.deepEqual(locus.receiving, f.events[6]);
  assert.equal(Object.hasOwn(locus, "settlement"), false);
  assert.deepEqual(p.ledger.checkpoint, f.events.at(-1).chainPosition);
  const expectedHistory = canonical("modeled-union-dimension.ManagedExchangeHistory", { type: "ManagedExchangeHistory", profile: PROFILE, profileId: PROFILE_ID, chainId: CHAIN, exchange: HUB, events: f.events });
  assert.equal(p.ledger.historyNi, expectedHistory.token);
  assert.deepEqual(p.events, f.events);
});

test("provider submission remains Submitted with no inferred acceptance", () => {
  const f = fixture(), locus = demandLocus(create(f.events.slice(0, 6)), f);
  assert.equal(locus.phase, "Submitted"); assert.deepEqual(locus.submission, f.events[5]);
  assert.equal(locus.receiving, null); assert.equal(locus.resourceState.sequence, "3");
  assert.equal(locus.resourceState.controller, REQUESTER);
});

test("model snapshots detach source events and mutable carrier bytes", () => {
  const f = fixture(), events = structuredClone(f.events.slice(0, 2));
  events[1].carrier = new Uint8Array(f.materials.demand.bytes);
  const model = create(events), before = model.presentation();
  events[1].carrier[0] ^= 255; events[1].resourceState.content = Z;
  const after = model.presentation();
  assert.deepEqual(after, before); assert.equal(after.events[1].carrierHex, hex(f.materials.demand.bytes));
  assert.equal(Object.hasOwn(after.events[1], "carrier"), false);
});

for (const [label, mutate] of [
  ["legacy settlement in managed history", (e) => { e[5].kind = "DemandSettled"; }],
  ["different profile", (e) => { e[1].profile = "legacy:semiotic-exchange:v1"; }],
  ["different profile identity", (e) => { e[1].profileId = G; }],
  ["different chain", (e) => { e[1].chainId = "eip155:1"; }],
  ["different hub", (e) => { e[1].exchange = OTHER; }],
  ["uppercase digest", (e) => { e[1].resourceState.resource = e[1].resourceState.resource.toUpperCase().replace("0X", "0x"); }],
  ["noncanonical decimal sequence", (e) => { e[1].resourceState.sequence = "01"; }],
  ["noncanonical decimal block", (e) => { e[1].chainPosition.blockNumber = "013"; }],
]) test(`managed history refuses ${label}`, () => {
  const f = fixture(), changed = structuredClone(f.events); mutate(changed);
  assert.throws(() => create(changed));
});

test("native and semantic events must share their full adjacent occurrence", () => {
  for (const changes of [{ transactionHash: G }, { transactionIndex: 1 }, { blockNumber: "14" }, { blockHash: G }, { logIndex: 3 }]) {
    const events = structuredClone(fixture().events); Object.assign(events[1].nativePosition, changes);
    assert.throws(() => create(events));
  }
  const events = fixture().events;
  assert.throws(() => create([events[1], events[0]]));
  assert.throws(() => create([...events, events.at(-1)]));
});

test("managed replay refuses missing admission, displaced resource, stale sequence and prior head", () => {
  const f = fixture(); assert.throws(() => create(f.events.slice(3)));
  for (const changes of [{ resource: f.cell }, { controller: PROVIDER }, { kind: hash("Actor") }, { priorContent: Z }, { priorSequence: "1" }, { sequence: "18446744073709551616" }]) {
    const events = structuredClone(f.events); Object.assign(events[5].resourceState, changes);
    assert.throws(() => create(events));
  }
});

test("carrier bytes, NI and carrier digest cannot be substituted independently", () => {
  for (const mutate of [
    (e) => { e[1].carrierNi = ni(Buffer.from("another carrier")); },
    (e) => { e[1].carrierHex = "0x00"; },
    (e) => { e[1].carrierId = G; },
  ]) { const events = structuredClone(fixture().events); mutate(events); assert.throws(() => create(events)); }
});

test("retirement blocks fresh selection while preserving the selected provider obligation", () => {
  assert.throws(() => create(fixture({ retirementBeforeSelection: true }).events));
  const f = fixture(), selected = create(f.events.slice(0, 5));
  const provider = selected.restrictedArena(PROVIDER).actions;
  const submit = provider.find((action) => action.operation === "submitDemandResult");
  assert.ok(submit); assert.equal(submit.cell, f.cell); assert.equal(submit.expectedSequence, "2");
  assert.equal(provider.some((action) => action.operation === "retireCell"), false);
  assert.equal(selected.restrictedArena(REQUESTER).actions.some((action) => action.operation === "submitDemandResult"), false);
});

test("restricted moves carry fixed native argument prefixes and the actual acting account", () => {
  const f = fixture();
  const cases = [
    [1, PROVIDER, "retireCell", [f.cell, "1"]],
    [2, PROVIDER, "offerDemand", [f.demand, "1", f.cell, "1"]],
    [3, REQUESTER, "purchaseMove", [f.demand, "1", f.offer, "1"]],
    [5, PROVIDER, "submitDemandResult", [f.demand, "2", f.offer]],
    [6, REQUESTER, "receiveDemand", [f.demand, "3", f.offer, f.materials.result.digest]],
  ];
  for (const [count, actor, operation, args] of cases) {
    const action = create(f.events.slice(0, count)).restrictedArena(actor).actions.find((a) => a.operation === operation);
    assert.ok(action, operation); assert.deepEqual(action.args, args); assert.equal(action.actor, actor);
    assert.equal(action.profile, PROFILE); assert.equal(action.chainId, CHAIN); assert.equal(action.exchange, HUB);
    if (["offerDemand", "submitDemandResult", "receiveDemand"].includes(operation)) assert.equal(action.carrierRequired, true);
  }
  assert.equal(create(f.events.slice(0, 6)).restrictedArena(PROVIDER).actions.some((a) => a.operation === "receiveDemand"), false);
});

test("restricted action digest commits canonical returned bytes rather than NI text", () => {
  const f = fixture(), model = create(f.events.slice(0, 3));
  const action = model.restrictedArena(REQUESTER).actions.find((a) => a.operation === "purchaseMove");
  const identified = canonical("modeled-union-dimension.RestrictedModeledUnionAction", action.actionIdentity);
  assert.equal(action.id, identified.token); assert.equal(action.actionDigest, sha(identified.bytes));
  assert.notEqual(action.actionDigest, sha(Buffer.from(action.id)));
  assert.equal(action.actionIdentity.type, "RestrictedModeledUnionAction");
  assert.equal(action.actionIdentity.actor, REQUESTER); assert.equal(action.actionIdentity.historyNi, model.presentation().ledger.historyNi);
  assert.deepEqual(action.checkpoint, f.events[2].chainPosition);
  assert.deepEqual(action.observedResources, f.events.slice(0, 3).map((e) => e.resourceState).sort((a, b) => a.resource.localeCompare(b.resource)));
  const historyNi = canonical("modeled-union-dimension.ManagedExchangeHistory", { type: "ManagedExchangeHistory", profile: PROFILE, profileId: PROFILE_ID, chainId: CHAIN, exchange: HUB, events: f.events.slice(0, 3) }).token;
  assert.deepEqual(action.actionIdentity, {
    type: "RestrictedModeledUnionAction", actor: REQUESTER,
    operation: "purchaseMove", demand: f.demand, offer: f.offer, cell: f.cell,
    expectedDemandSequence: "1", expectedCellSequence: "1", args: [f.demand, "1", f.offer, "1"], carrierRequired: false,
    profile: PROFILE, profileId: PROFILE_ID, chainId: CHAIN, exchange: HUB,
    checkpoint: f.events[2].chainPosition, historyNi,
    observedResources: f.events.slice(0, 3).map((e) => e.resourceState).sort((a, b) => a.resource.localeCompare(b.resource)),
  });
  for (const forbidden of ["available", "evidence", "unavailability", "id", "actionDigest"]) assert.equal(Object.hasOwn(action.actionIdentity, forbidden), false);
});

test("v2 carrier admission preserves the original producer's exact canonical bytes and NI", () => {
  const induced = induceCapabilityRepairDemand({ raiser: REQUESTER, locus: "urn:fixture:locus", operation: "provide-result", objective: "receive the result", refusalCode: "provider-unavailable", refusalWitnessNis: [ni(Buffer.from("refusal"))], requiredStandard: "fixture-standard", inputNi: ni(Buffer.from("input")) });
  const m = originalDemand(induced), received = admission(m);
  assert.equal(received.version, 2); assert.equal(received.contentNi, induced.demandNi);
  assert.equal(received.carrierHex, hex(induced.demandBytes)); assert.deepEqual(received.carrier, m.carrier);
  assert.equal(sha(raw(received.carrierHex)), induced.demandBytes32);
});

test("v2 carrier admission refuses wrong value, token and noncanonical supplied bytes", () => {
  const m = material("SemioticExchangeDemandCarrier", { objective: "one declared objective" });
  const input = { carrier: m.carrier, canonicalBytes: m.bytes, contentNi: m.contentNi, protocolVerificationReceiptNis: [ni(Buffer.from("protocol"))] };
  assert.throws(() => createCarrierAdmissionReceipt({ ...input, carrier: { ...m.carrier, value: { objective: "another objective" } } }));
  assert.throws(() => createCarrierAdmissionReceipt({ ...input, contentNi: ni(Buffer.from("other bytes")) }));
  assert.throws(() => createCarrierAdmissionReceipt({ ...input, canonicalBytes: Buffer.concat([m.bytes, Buffer.from([0])]) }));
});

const standing = (object, support) => {
  const identified = canonical(`modeled-union-dimension.${object.type}`, object);
  return { type: "FederationHistoryStanding", objectNi: identified.token, objectBytes: identified.bytes, object, witnesses: [ni(Buffer.from(`witness:${identified.token}`))], support };
};
function workFixture() {
  const carrier = createWorkCarrier({
    endeavor: { id: "receive-work" }, project: { id: "native-integration", endeavor: "receive-work" },
    milestone: { id: "one-result", project: "native-integration" }, duty: { id: "perform-request", office: "provider-office" },
    qualification: { ranks: ["qualified"], cohorts: ["fixture-cohort"], capabilities: ["perform-request"] }, evidenceNis: [ni(Buffer.from("work-law"))],
  });
  const f = fixture({ demandMaterial: material(carrier.type, carrier.value) });
  const completed = standing({ type: "WorkAssignmentAttemptReceipt", version: 1, demand: f.demand, offer: f.offer, actor: PROVIDER, office: "provider-office", duty: "perform-request", outcome: "completed", result: f.materials.result.digest, outputReceiptNi: ni(Buffer.from("provider-output")) }, { positive: true, negative: false, value: "potential" });
  const refused = standing({ type: "WorkAssignmentAttemptReceipt", version: 1, demand: f.demand, offer: f.offer, actor: PROVIDER, office: "provider-office", duty: "perform-request", outcome: "refused", residueNi: ni(Buffer.from("earlier-obstruction")) }, { positive: false, negative: true, value: "active" });
  return { ...f, completed, refused };
}

test("provider completion evidence cannot settle managed Work before requester receiving", () => {
  const f = workFixture(), carrierAdmissions = Object.values(f.materials).map(admission);
  const model = create(f.events.slice(0, 6), { carrierAdmissions, federationHistory: [f.completed] });
  const work = model.presentation().workCirculation.loci.find((locus) => locus.type === "UnionWorkLocus");
  assert.ok(work); assert.equal(work.phase, "engaged"); assert.equal(demandLocus(model, f).phase, "Submitted");
  for (const locus of model.presentation().loci.filter((locus) => ["UnionMilestoneLocus", "UnionProjectLocus", "UnionEndeavorLocus"].includes(locus.type))) assert.notEqual(locus.phase, "settled");
});

test("requester receiving plus the exact completion settles Work and ancestors while retaining denial", () => {
  const f = workFixture(), carrierAdmissions = Object.values(f.materials).map(admission);
  const withoutCompletion = create(f.events, { carrierAdmissions }).presentation().workCirculation.loci.find((locus) => locus.type === "UnionWorkLocus");
  assert.notEqual(withoutCompletion.phase, "settled");
  const model = create(f.events, { carrierAdmissions, federationHistory: [f.refused, f.completed] });
  const work = model.presentation().workCirculation.loci.find((locus) => locus.type === "UnionWorkLocus");
  assert.equal(work.phase, "settled"); assert.equal(work.grayDegree, "stable"); assert.equal(work.attempts.length, 2); assert.equal(work.cultivation.length, 1);
  for (const type of ["UnionMilestoneLocus", "UnionProjectLocus", "UnionEndeavorLocus"]) assert.equal(model.presentation().loci.find((locus) => locus.type === type).phase, "settled");
});

test("a completed attempt for a different result stays evidence without settling received Work", () => {
  const f = workFixture(), carrierAdmissions = Object.values(f.materials).map(admission);
  const wrong = standing({ ...f.completed.object, result: G }, f.completed.support);
  const model = create(f.events, { carrierAdmissions, federationHistory: [wrong] });
  const work = model.presentation().workCirculation.loci.find((locus) => locus.type === "UnionWorkLocus");
  assert.notEqual(work.phase, "settled"); assert.equal(work.attempts.length, 1);
});

test("capability repair succeeds only after the exact submitted result is explicitly received", () => {
  const induced = induceCapabilityRepairDemand({ raiser: REQUESTER, locus: "urn:fixture:capability", operation: "repair-capability", objective: "receive repaired capacity", refusalCode: "unavailable", refusalWitnessNis: [ni(Buffer.from("refusal"))], requiredStandard: "fixture-standard", inputNi: ni(Buffer.from("input")) });
  const f = fixture({ demandMaterial: originalDemand(induced), law: induced.wantedLawDigest, grounding: induced.groundingDigest });
  const completed = standing({ type: "CapabilityProviderAttemptReceipt", version: 1, demand: f.demand, offer: f.offer, provider: PROVIDER, outcome: "completed", result: f.materials.result.digest, outputReceiptNi: ni(Buffer.from("capability-output")) }, { positive: true, negative: false, value: "potential" });
  const options = { capabilityDemandInductionReceipts: [induced], federationHistory: [completed] };
  assert.notEqual(create(f.events.slice(0, 6), options).presentation().capabilityDemandMetabolism[0].phase, "succeeded");
  assert.equal(create(f.events, options).presentation().capabilityDemandMetabolism[0].phase, "succeeded");
  const ready = create([], { capabilityDemandInductionReceipts: [induced] }).restrictedArena(REQUESTER).actions.find((action) => action.operation === "raiseDemand");
  assert.equal(ready.demandBytes32, induced.demandBytes32); assert.equal(Object.hasOwn(ready, "demand"), false);
});

test("one generic induction cannot silently choose among distinct governed Demand handles", () => {
  const observations = PRIVATE_LIVE_MUD_REQUIREMENTS.map(({ id }) => ({ requirement: id, positive: [ni(Buffer.from(id))], negative: [] }));
  const final = observations.find((item) => item.requirement === "private-live-mud"); final.positive = []; final.negative = [ni(Buffer.from("unreceived-deployment"))];
  const induced = inducePrivateLiveMudDemand({ observations }), demandMaterial = originalDemand(induced);
  const a = fixture({ demandMaterial, law: induced.wantedLawDigest, grounding: induced.groundingDigest });
  const b = fixture({ requester: OTHER, demandMaterial, law: induced.wantedLawDigest, grounding: induced.groundingDigest });
  const second = { ...b.events[1], chainPosition: position(14, 1), nativePosition: position(14, 0) };
  const events = [a.events[1], second];
  assert.notEqual(a.demand, b.demand); assert.equal(a.materials.demand.digest, b.materials.demand.digest);
  assert.throws(() => create(events, { demandInductionReceipts: [induced] }), /ambig|binding/iu);
  const model = create(events, { demandInductionReceipts: [induced], demandInductionBindings: [{ receiptNi: induced.id, demand: a.demand }] });
  assert.equal(model.presentation().loci.filter((locus) => locus.type === "SemioticDemandLocus").length, 2);
});

// These bodies have authentic supplier identity domains but deliberately
// synthetic cryptographic observations. They establish only the model's
// candidate-bound readiness checks. The real account actuator must reverify.
// The managed context uses primitive caveats: actual UCAN 0.1.2 receiving
// refused nested nb objects under its original attenuation rules. The prior
// oracle and results are retained with the contract-revision evidence.
function authorityPair(action, mutate = () => {}) {
  const capability = {
    with: `did:pkh:${CHAIN}:${action.actor}`, can: "semiotic-exchange/purchase-move",
    nb: { marshProfile: PROFILE, marshExchange: HUB, marshActionId: action.id, purpose: "independent readiness assay" },
  };
  const capabilityNi = canonical("animating.ucan-semantic-material", capability).token;
  const ucan = {
    type: "UcanInvocationVerificationReceipt", version: 1, disposition: "authorized", revocationStatus: "active",
    controller: "did:key:zController111111", actor: "did:key:zActor11111111111",
    invocationCid: "bafy-independent-invocation", delegationCid: "bafy-independent-delegation", capabilityNi, capability,
  };
  const binding = {
    type: "EnterpriseAccountControllerBindingReceipt", version: 1, disposition: "bound", protocol: "ERC-1271",
    account: action.actor, chain: CHAIN, resource: capability.with,
    controller: ucan.controller, actor: ucan.actor, invocationCid: ucan.invocationCid, delegationCid: ucan.delegationCid,
    capabilityNi, capability: structuredClone(capability), rmnSemanticDigest: action.actionDigest,
  };
  mutate(ucan, binding);
  return {
    ucan: [{ ...ucan, id: canonical("animating.ucan-semantic-material", ucan).token }],
    controllerBindings: [{ ...binding, id: canonical("ethereum.enterprise-account-controller-binding", binding).token }],
  };
}
function readinessFixture() {
  const f = fixture(), events = f.events.slice(0, 3), carrierAdmissions = Object.values(f.materials).map(admission);
  const calls = [], actuator = async (action) => { calls.push(action); return { received: action.id }; };
  const candidate = create(events, { carrierAdmissions, actuator }).restrictedArena(REQUESTER).actions.find((a) => a.operation === "purchaseMove");
  return { f, events, carrierAdmissions, calls, actuator, candidate };
}

test("exact candidate-bound receipt pair enables one restricted action without changing its identity", async () => {
  const r = readinessFixture(), authorityReceipts = authorityPair(r.candidate);
  assert.equal(r.candidate.available, false);
  const model = create(r.events, { carrierAdmissions: r.carrierAdmissions, actuator: r.actuator, authorityReceipts });
  const action = model.restrictedArena(REQUESTER).actions.find((a) => a.operation === "purchaseMove");
  assert.equal(action.available, true); assert.equal(action.id, r.candidate.id); assert.equal(action.actionDigest, r.candidate.actionDigest);
  assert.equal(action.evidence.ucanInvocationVerificationReceiptNi, authorityReceipts.ucan[0].id);
  assert.equal(action.evidence.enterpriseAccountControllerBindingReceiptNi, authorityReceipts.controllerBindings[0].id);
  assert.deepEqual(await model.actuate(action.id, REQUESTER), { received: action.id });
  assert.equal(r.calls.length, 1); assert.equal(r.calls[0].actor, REQUESTER);
});

test("receipt pair refuses different account, chain, hub, action, ability, digest and full nb", () => {
  const r = readinessFixture();
  const mutations = [
    (_u, b) => { b.account = OTHER; },
    (_u, b) => { b.chain = "eip155:1"; },
    (u, b) => { u.capability.nb.marshExchange = OTHER; b.capability.nb.marshExchange = OTHER; },
    (u, b) => { u.capability.nb.marshActionId = ni(Buffer.from("stale action")); b.capability.nb.marshActionId = u.capability.nb.marshActionId; },
    (u, b) => { u.capability.can = "semiotic-exchange/receive-demand"; b.capability.can = u.capability.can; },
    (_u, b) => { b.rmnSemanticDigest = G; },
    (_u, b) => { b.capability.nb.purpose = "another capability condition"; },
    (u) => { u.revocationStatus = "revoked"; },
    (_u, b) => { b.actor = "did:key:zAnotherActor111111"; },
    (_u, b) => { b.invocationCid = "bafy-other-invocation"; },
  ];
  for (const mutate of mutations) {
    const authorityReceipts = authorityPair(r.candidate, (u, b) => {
      mutate(u, b);
      // Keep UCAN content identification consistent so this reaches the
      // changed candidate/account/join predicate rather than a malformed ID.
      u.capabilityNi = canonical("animating.ucan-semantic-material", u.capability).token;
      b.capabilityNi = u.capabilityNi;
    });
    const model = create(r.events, { carrierAdmissions: r.carrierAdmissions, actuator: r.actuator, authorityReceipts });
    const action = model.restrictedArena(REQUESTER).actions.find((a) => a.operation === "purchaseMove");
    assert.equal(action.available, false);
  }
  assert.equal(r.calls.length, 0);
});

test("equal arbitrary capability tokens or altered canonical receipt IDs cannot authorize", () => {
  const r = readinessFixture();
  for (const mutate of [
    (pair) => { pair.ucan[0].id = ni(Buffer.from("forged UCAN receipt")); },
    (pair) => { pair.controllerBindings[0].id = ni(Buffer.from("forged binding receipt")); },
    (pair) => {
      const u = { ...pair.ucan[0], capabilityNi: ni(Buffer.from("arbitrary capability")) }; delete u.id;
      const b = { ...pair.controllerBindings[0], capabilityNi: u.capabilityNi }; delete b.id;
      pair.ucan[0] = { ...u, id: canonical("animating.ucan-semantic-material", u).token };
      pair.controllerBindings[0] = { ...b, id: canonical("ethereum.enterprise-account-controller-binding", b).token };
    },
  ]) {
    const authorityReceipts = authorityPair(r.candidate); mutate(authorityReceipts);
    const model = create(r.events, { carrierAdmissions: r.carrierAdmissions, actuator: r.actuator, authorityReceipts });
    assert.equal(model.restrictedArena(REQUESTER).actions.find((a) => a.operation === "purchaseMove").available, false);
  }
});

test("previously bound readiness cannot authorize a later history checkpoint", () => {
  const r = readinessFixture(), authorityReceipts = authorityPair(r.candidate);
  const extra = fixture({ requester: OTHER }).events[1];
  extra.chainPosition = position(15, 1); extra.nativePosition = position(15, 0);
  const model = create([...r.events, extra], { carrierAdmissions: r.carrierAdmissions, actuator: r.actuator, authorityReceipts });
  const candidate = model.restrictedArena(REQUESTER).actions.find((a) => a.operation === "purchaseMove");
  assert.notEqual(candidate.id, r.candidate.id); assert.notEqual(candidate.actionDigest, r.candidate.actionDigest);
  assert.equal(candidate.available, false); assert.equal(r.calls.length, 0);
});
