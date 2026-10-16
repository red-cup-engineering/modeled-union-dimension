import assert from "node:assert/strict";
import test from "node:test";
import { createCarrierAdmissionReceipt, createModeledUnionDimension, projectTerritoryFoam } from "../src/index.mjs";
import { makeNiUri } from "@red-cup-engineering/uri-services-section/ni-uri";

const ni = (value) => makeNiUri(Buffer.from(value, "utf8"));
const packageName = "@red-cup-engineering/example-cell";
const locus = `package:${packageName}`;
const territory = Object.freeze({
  type: "NodeWorkspaceSourceCatalogReceipt", version: 1, id: ni("territory"),
  catalog: { type: "NodeWorkspaceSourceCatalog" }, denominator: { type: "admitted-package-manifest-set", count: 1 },
  packages: [{
    name: packageName, version: "0.1.0", path: "services/example-cell",
    manifestEvidence: { packageJsonNi: ni("manifest") }, classificationReceiptNi: ni("classification"),
    proofPath: [{ ordinal: 0, type: "workspace-root", parent: null, localRecognition: "package.json", witnessed: true }],
    service: { actor: "urn:ame:example-cell", nodeId: "example-cell", organizationalKind: "micro-enterprise", operations: ["observe"] },
  }],
  relations: [],
});
const admission = createCarrierAdmissionReceipt({ carrier: { type: territory.type, value: territory }, protocolVerificationReceiptNis: [ni("territory-protocol")] });
const family = (observers) => ({ type: "FoamObserverFamily", version: 1, observers });
const commitment = (locusName, polarity, witness) => ({ locus: locusName, polarity, witnessNis: [ni(witness)] });

test("the same admitted territory is void, bulk, or interface relative to observer family D", () => {
  const empty = projectTerritoryFoam({ territoryAdmission: admission, observerFamily: family([]) });
  const bulk = projectTerritoryFoam({ territoryAdmission: admission, observerFamily: family([{ actor: "urn:observer:runtime", commitments: [commitment(locus, "positive", "runtime-positive")] }]) });
  const wall = projectTerritoryFoam({ territoryAdmission: admission, observerFamily: family([
    { actor: "urn:observer:runtime", commitments: [commitment(locus, "positive", "runtime-positive")] },
    { actor: "urn:observer:audit", commitments: [commitment(locus, "negative", "audit-negative")] },
  ]) });
  assert.equal(empty.sections[0].phase, "void");
  assert.equal(bulk.sections[0].phase, "positive-bulk");
  assert.equal(wall.sections[0].phase, "interface");
  assert.equal(wall.sections[0].four.charge, "stable");
  assert.equal(wall.sections[0].four.symbol, "top");
  assert.notEqual(empty.observerFamily.id, bulk.observerFamily.id);
  assert.notEqual(bulk.id, wall.id);
});

test("each derived section retains territory, assertion, and closure content-address paths", () => {
  const field = projectTerritoryFoam({ territoryAdmission: admission, observerFamily: family([{ actor: "urn:observer:runtime", commitments: [commitment(locus, "positive", "runtime-positive")] }]) });
  const section = field.sections[0];
  assert.equal(section.witnessPath.territory.territoryAdmissionReceiptNi, admission.id);
  assert.equal(section.witnessPath.territory.classificationReceiptNi, ni("classification"));
  assert.equal(section.witnessPath.commitments[0].witnessNis[0], ni("runtime-positive"));
  assert.match(section.witnessPath.closureEvidenceNi, /^ni:\/\/\/sha-256;/u);
  assert.equal(section.convergence.regime, "strict-finite");
  assert.equal(section.convergence.fixedPoint, "potential");
  assert.equal(section.convergence.laws.settlesByThree, true);
});

test("the MUD core appends admitted territory sections to its canonical loci presentation", () => {
  const observerFamily = family([{ actor: "urn:observer:runtime", commitments: [commitment(locus, "positive", "runtime-positive")] }]);
  const presentation = createModeledUnionDimension({
    events: [], chainId: "eip155:5615610", exchange: "0x98bBC65824962b61dF876A47B5779C4EcBBD4939",
    carrierAdmissions: [admission], observerFamily,
  }).presentation();
  assert.equal(presentation.version, 7);
  assert.equal(presentation.loci[0].type, "CodebaseTerritoryActorLocus");
  assert.equal(presentation.loci[0].id, locus);
  assert.equal(presentation.loci[0].phase, "positive-bulk");
  assert.equal(presentation.loci[0].sectionNi, presentation.territoryFoam.sections[0].id);
});

test("negation self-dual values and higher-regime obstruction are explicit", () => {
  const field = projectTerritoryFoam({ territoryAdmission: admission, observerFamily: family([]) });
  assert.deepEqual(field.fourNegationSelfDualLocus.values, ["absurd", "stable"]);
  assert.match(field.proofBoundary.obstruction, /cannot witness Scott, transfinite-bounded, or aperiodic/u);
});

test("refuses unwitnessed, off-territory, and recursively nested commitments", () => {
  assert.throws(() => projectTerritoryFoam({ territoryAdmission: admission, observerFamily: family([{ actor: "urn:observer:runtime", commitments: [{ locus, polarity: "positive", witnessNis: [] }] }]) }), /at least one witness ni/u);
  assert.throws(() => projectTerritoryFoam({ territoryAdmission: admission, observerFamily: family([{ actor: "urn:observer:runtime", commitments: [commitment("package:elsewhere", "positive", "elsewhere")] }]) }), /outside the admitted territory/u);
  const nestedOnly = family([{ actor: "urn:observer:runtime", commitments: [] }]);
  nestedOnly.observers[0].nested = { commitments: [commitment(locus, "positive", "nested-lie")] };
  assert.equal(projectTerritoryFoam({ territoryAdmission: admission, observerFamily: nestedOnly }).sections[0].phase, "void");
});

test("reuses the exact section only for identical frozen carrier and observer coordinates", () => {
  const makeFrozenFamily = () => Object.freeze({ type: "FoamObserverFamily", version: 1, observers: Object.freeze([Object.freeze({ actor: "urn:observer:runtime", commitments: Object.freeze([Object.freeze({ locus, polarity: "positive", witnessNis: Object.freeze([ni("runtime-positive")]) })]) })]) });
  const observerFamily = makeFrozenFamily();
  const first = projectTerritoryFoam({ territoryAdmission: admission, observerFamily });
  const second = projectTerritoryFoam({ territoryAdmission: admission, observerFamily });
  assert.equal(second, first);
  const structurallyEqual = makeFrozenFamily();
  assert.notEqual(projectTerritoryFoam({ territoryAdmission: admission, observerFamily: structurallyEqual }), first);
});

test("the MUD presentation carries only the canonical mission law locus and content address", () => {
  const missionLaw = { type: "ModeledUnionMissionLawLocus", locus: "law:semiotic-foam-one-machine", carrierNi: ni("one-machine-law"), language: "rmn/v2" };
  const presentation = createModeledUnionDimension({ events: [], chainId: "eip155:5615610", exchange: "0x98bBC65824962b61dF876A47B5779C4EcBBD4939", missionLaw }).presentation();
  assert.deepEqual(presentation.missionLaw, missionLaw);
  assert.throws(() => createModeledUnionDimension({ events: [], chainId: "eip155:5615610", exchange: "0x98bBC65824962b61dF876A47B5779C4EcBBD4939", missionLaw: { ...missionLaw, carrierNi: "not-an-ni" } }), /missionLaw/u);
});

test("a shallow-frozen family is reprojected when nested commitment polarity changes", () => {
  const observed = commitment(locus, "positive", "runtime-witness");
  const observerFamily = Object.freeze(family([{ actor: "urn:observer:runtime", commitments: [observed] }]));
  const first = projectTerritoryFoam({ territoryAdmission: admission, observerFamily });

  observed.polarity = "negative";
  const second = projectTerritoryFoam({ territoryAdmission: admission, observerFamily });

  assert.notEqual(second, first);
  assert.notEqual(second.observerFamily.id, first.observerFamily.id);
  assert.equal(first.sections[0].phase, "positive-bulk");
  assert.equal(second.sections[0].phase, "negative-bulk");
  assert.equal(projectTerritoryFoam({ territoryAdmission: admission, observerFamily }), second);
});

test("a shallow-frozen family is reprojected when nested witness evidence changes", () => {
  const observed = commitment(locus, "positive", "original-witness");
  const observerFamily = Object.freeze(family([{ actor: "urn:observer:runtime", commitments: [observed] }]));
  const first = projectTerritoryFoam({ territoryAdmission: admission, observerFamily });

  observed.witnessNis[0] = ni("replacement-witness");
  const second = projectTerritoryFoam({ territoryAdmission: admission, observerFamily });

  assert.notEqual(second, first);
  assert.notEqual(second.observerFamily.id, first.observerFamily.id);
  assert.equal(first.sections[0].witnessPath.commitments[0].witnessNis[0], ni("original-witness"));
  assert.equal(second.sections[0].witnessPath.commitments[0].witnessNis[0], ni("replacement-witness"));
  assert.equal(second.sections[0].phase, "positive-bulk");
});

test("cached families still reject newly invalid or off-territory nested commitments", () => {
  const observed = commitment(locus, "positive", "runtime-witness");
  const commitments = [observed];
  const observerFamily = Object.freeze(family([{ actor: "urn:observer:runtime", commitments }]));
  const first = projectTerritoryFoam({ territoryAdmission: admission, observerFamily });

  observed.polarity = "unknown";
  assert.throws(() => projectTerritoryFoam({ territoryAdmission: admission, observerFamily }), /polarity must be positive or negative/u);

  observed.polarity = "positive";
  observed.witnessNis.length = 0;
  assert.throws(() => projectTerritoryFoam({ territoryAdmission: admission, observerFamily }), /at least one witness ni/u);

  observed.witnessNis.push(ni("runtime-witness"));
  commitments.push(commitment("package:elsewhere", "negative", "off-territory-witness"));
  assert.throws(() => projectTerritoryFoam({ territoryAdmission: admission, observerFamily }), /outside the admitted territory/u);

  commitments.pop();
  assert.equal(projectTerritoryFoam({ territoryAdmission: admission, observerFamily }), first);
});

test("a frozen accessor family is compared by its currently admitted evidence", () => {
  let observers = [{ actor: "urn:observer:runtime", commitments: [commitment(locus, "positive", "runtime-positive")] }];
  const observerFamily = Object.freeze({ type: "FoamObserverFamily", version: 1, get observers() { return observers; } });
  const first = projectTerritoryFoam({ territoryAdmission: admission, observerFamily });

  observers = [{ actor: "urn:observer:audit", commitments: [commitment(locus, "negative", "audit-negative")] }];
  const second = projectTerritoryFoam({ territoryAdmission: admission, observerFamily });

  assert.notEqual(second, first);
  assert.equal(first.sections[0].phase, "positive-bulk");
  assert.equal(second.sections[0].phase, "negative-bulk");
});

test("canonical-equivalent observer and witness reorderings reuse the same projection", () => {
  const observers = [
    { actor: "urn:observer:runtime", commitments: [
      { locus, polarity: "positive", witnessNis: [ni("runtime-positive-a"), ni("runtime-positive-b")] },
      commitment(locus, "negative", "runtime-negative"),
    ] },
    { actor: "urn:observer:audit", commitments: [
      commitment(locus, "negative", "audit-negative"),
      { locus, polarity: "positive", witnessNis: [ni("audit-positive-a"), ni("audit-positive-b")] },
    ] },
  ];
  const observerFamily = Object.freeze(family(observers));
  const first = projectTerritoryFoam({ territoryAdmission: admission, observerFamily });

  observers.reverse();
  for (const observer of observers) {
    observer.commitments.reverse();
    for (const observed of observer.commitments) {
      observed.witnessNis.reverse();
      observed.witnessNis.push(observed.witnessNis[0]);
    }
  }
  const second = projectTerritoryFoam({ territoryAdmission: admission, observerFamily });

  assert.equal(second.observerFamily.id, first.observerFamily.id);
  assert.equal(second, first);
});

test("many admitted territories cannot permanently accumulate frozen projection cache entries", () => {
  const observerFamily = Object.freeze(family([]));
  const first = projectTerritoryFoam({ territoryAdmission: admission, observerFamily });
  const stillCached = projectTerritoryFoam({ territoryAdmission: admission, observerFamily });
  assert.strictEqual(stillCached, first, "hot canonical reuse remains identity-stable");
  // More than the declared 256 territorial slots, using genuinely distinct,
  // admitted content identities rather than arbitrary malformed user inputs.
  for (let i = 0; i < 270; i++) {
    const changingTerritory = structuredClone(territory);
    changingTerritory.id = ni("bounded-foam-territory-" + i);
    const changedAdmission = createCarrierAdmissionReceipt({
      carrier: { type: changingTerritory.type, value: changingTerritory },
      protocolVerificationReceiptNis: [ni("territory-protocol")],
    });
    const field = projectTerritoryFoam({ territoryAdmission: changedAdmission, observerFamily });
    assert.equal(field.sections[0].phase, "void");
  }
  const receivedAgain = projectTerritoryFoam({ territoryAdmission: admission, observerFamily });
  assert.equal(receivedAgain.id, first.id, "eviction may never change the semantic content address");
  assert.notStrictEqual(receivedAgain, first, "the cold territorial entry was evicted");
  assert.strictEqual(projectTerritoryFoam({ territoryAdmission: admission, observerFamily }),
    receivedAgain, "revisited work is cached again");
});
