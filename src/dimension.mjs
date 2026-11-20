import { readingOfSides } from "@red-cup-engineering/metrologic/four";
import { isNiUri, makeNiUri } from "@red-cup-engineering/uri-engineering-services-section/ni-uri";
import { EMPTY_WITNESS_ROOT, admitJsonSemanticContent, identifyJsonSemanticContent } from "@red-cup-engineering/computer-code-engine/semiotic-expression-notation/semantic-content-identity";
import { projectTerritoryFoam } from "./foam-field.mjs";
import { projectLSpace } from "./l-space.mjs";
import { projectWorkCirculation } from "./work-circulation.mjs";
import { induceUnboundCodexToolBindingDemands, projectCodexToolObservations } from "./codex-tool-observation.mjs";

import { MARSH_EXCHANGE_PROFILE, MARSH_EXCHANGE_PROFILE_ID, LEGACY_EXCHANGE_PROFILE, replayManagedExchange, identifyManagedAction, niDigestHex, exactManagedAccount, managedEventKey } from "./managed-exchange.mjs";
export { MARSH_EXCHANGE_PROFILE, MARSH_EXCHANGE_PROFILE_ID, LEGACY_EXCHANGE_PROFILE } from "./managed-exchange.mjs";

export const ACTOR = "urn:ame:modeled-union-dimension";

const KINDS = Object.freeze(["CellSeated", "CellRetired", "DemandRaised", "DemandOffered", "PurchaseMoved", "DemandSettled"]);
const OPERATION_ABILITY = Object.freeze({
  raiseDemand: "semiotic-exchange/raise-demand",
  retireCell: "semiotic-exchange/retire-cell",
  offerDemand: "semiotic-exchange/offer-demand",
  purchaseMove: "semiotic-exchange/purchase-move",
  settleDemand: "semiotic-exchange/settle-demand",
  submitDemandResult: "semiotic-exchange/submit-demand-result",
  receiveDemand: "semiotic-exchange/receive-demand",
});

function required(value, label) {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${label} must be a non-empty string`);
  return value;
}
function exactNi(value, label) {
  if (!isNiUri(value)) throw new TypeError(`${label} must be a canonical SHA-256 ni identifier`);
  return value;
}
function same(left, right) { return String(left).toLowerCase() === String(right).toLowerCase(); }
function find(items, field, value) { return items.find((item) => same(item[field], value)); }
function chainKey(event) { return event.profile === MARSH_EXCHANGE_PROFILE ? managedEventKey(event) : `${event.chainPosition.blockNumber.toString()}:${event.chainPosition.logIndex}`; }
function before(left, right) {
  const a = BigInt(left.chainPosition.blockNumber), b = BigInt(right.chainPosition.blockNumber);
  return a < b || (a === b && left.chainPosition.logIndex < right.chainPosition.logIndex);
}
function freeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}
function identify(value) { return identifyJsonSemanticContent({ objectKind: `modeled-union-dimension.${value?.type ?? "material"}`, value, witnessRoot: EMPTY_WITNESS_ROOT }).token; }
function identifyCarrier(carrier) { return identifyJsonSemanticContent({ objectKind: `semiotic-exchange.${carrier.type}`, value: carrier, witnessRoot: EMPTY_WITNESS_ROOT }).token; }

/** The single carrier boundary consumed by this MUD. */
export function createCarrierAdmissionReceipt({ carrier, protocolVerificationReceiptNis: protocolVerificationRecordNis, canonicalBytes, contentNi }) {
  if (carrier === null || typeof carrier !== "object" || Array.isArray(carrier)) throw new TypeError("carrier must be one typed decoded relational value");
  required(carrier.type, "carrier.type");
  if (!("value" in carrier)) throw new TypeError("carrier.value is required");
  if (!Array.isArray(protocolVerificationRecordNis) || protocolVerificationRecordNis.length === 0) throw new TypeError("at least one protocol verification receipt ni is required");
  const records = Object.freeze([...new Set(protocolVerificationRecordNis.map((ni, index) => exactNi(ni, `protocolVerificationReceiptNis[${index}]`)))].sort());
  let version = 1, carrierHex;
  if (canonicalBytes !== undefined) {
    if (!(canonicalBytes instanceof Uint8Array) || canonicalBytes.length === 0) throw new TypeError("canonicalBytes must be nonempty canonical SEN bytes");
    exactNi(contentNi, "contentNi");
    const canonical = admitJsonSemanticContent({ bytes: canonicalBytes, token: contentNi, objectKind: `semiotic-exchange.${carrier.type}` });
    if (identify(canonical.value) !== identify(carrier.value)) throw new Error("carrier value differs from its admitted canonical bytes");
    carrierHex = `0x${Array.from(canonicalBytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
    version = 2;
  } else {
    if (contentNi !== undefined) throw new TypeError("explicit contentNi requires canonicalBytes");
    contentNi = identifyCarrier(carrier);
  }
  const body = freeze({ type: "CarrierAdmissionReceipt", version, disposition: "admitted", contentNi,
    carrier: { type: carrier.type, value: structuredClone(carrier.value) }, protocolVerificationReceiptNis: records,
    ...(version === 2 ? { carrierHex } : {}) });
  return freeze({ id: identify(body), ...body });
}

function validateCarriers(values) {
  if (!Array.isArray(values)) throw new TypeError("carrierAdmissions must be an array");
  const byContent = new Map();
  for (const [index, value] of values.entries()) {
    if (value?.type !== "CarrierAdmissionReceipt" || ![1, 2].includes(value.version) || value.disposition !== "admitted") throw new TypeError(`carrierAdmissions[${index}] is not a CarrierAdmissionReceipt v1 or v2`);
    exactNi(value.id, `carrierAdmissions[${index}].id`); exactNi(value.contentNi, `carrierAdmissions[${index}].contentNi`);
    let canonicalBytes;
    if (value.version === 2) {
      if (!/^0x(?:[0-9a-f]{2})+$/u.test(value.carrierHex ?? "")) throw new TypeError("canonical carrierHex is required for admission v2");
      canonicalBytes = Uint8Array.from(value.carrierHex.slice(2).match(/../gu), (byte) => Number.parseInt(byte, 16));
    }
    const canonical = createCarrierAdmissionReceipt({ carrier: value.carrier, protocolVerificationReceiptNis: value.protocolVerificationReceiptNis,
      ...(value.version === 2 ? { canonicalBytes, contentNi: value.contentNi } : {}) });
    if (canonical.id !== value.id || canonical.contentNi !== value.contentNi) throw new Error(`carrierAdmissions[${index}] does not match its canonical identity`);
    if (byContent.has(value.contentNi)) throw new Error(`carrier ${value.contentNi} was admitted twice`);
    byContent.set(value.contentNi, canonical);
  }
  return byContent;
}

function validateFederationHistory(values) {
  if (!Array.isArray(values)) throw new TypeError("federationHistory must be an array of FederationHistoryStanding values");
  return freeze(values.map((standing, index) => {
    if (standing?.type !== "FederationHistoryStanding") throw new TypeError(`federationHistory[${index}] is not a FederationHistoryStanding`);
    exactNi(standing.objectNi, `federationHistory[${index}].objectNi`);
    if (identify(standing.object) !== standing.objectNi) throw new Error(`federationHistory[${index}] object differs from its canonical identity`);
    if (!Array.isArray(standing.witnesses) || standing.witnesses.length === 0) throw new TypeError(`federationHistory[${index}] has no carrier-admission witnesses`);
    standing.witnesses.forEach((ni, witness) => exactNi(ni, `federationHistory[${index}].witnesses[${witness}]`));
    const { positive, negative, value } = standing.support ?? {};
    const expected = positive && negative ? "stable" : positive ? "potential" : negative ? "active" : "absurd";
    if (value !== expected) throw new Error(`federationHistory[${index}] has incoherent FOUR support`);
    return standing;
  }));
}
function support(location, federationHistory) {
  let positive = false, negative = false;
  for (const standing of federationHistory) {
    if (standing.object?.type !== "SemioticSupportClaim") continue;
    const claim = standing.object;
    if (!claim || typeof claim !== "object" || !same(claim.locus, location)) continue;
    if (standing.support.positive) positive = true;
    if (standing.support.negative) negative = true;
  }
  return freeze({ positive, negative, charge: readingOfSides("knowledge", positive, negative) });
}
function relation(type, from, to, event) { return freeze({ type, from, to, chainPosition: event.chainPosition, ...(event.carrierNi ? { carrierNi: event.carrierNi } : {}), ...(event.profile === MARSH_EXCHANGE_PROFILE ? { profile: event.profile, chainId: event.chainId, exchange: event.exchange, nativePosition: event.nativePosition } : {}) }); }
function settlementEvidence(federationHistory) {
  const found = [];
  for (const standing of federationHistory) {
    if (standing.object?.type !== "X402SettlementEvidence" || !standing.support.positive) continue;
    const value = standing.object;
    if (value?.success === true && /^eip155:[1-9][0-9]*$/u.test(value.network ?? "")
      && /^0x[0-9a-fA-F]{64}$/u.test(value.transaction ?? "") && /^sha256:[0-9a-f]{64}$/u.test(value.invocation ?? "")
      && /^(?:0|[1-9][0-9]*)$/u.test(value.amount ?? "")) found.push(freeze({ ...structuredClone(value), federationCarrierAdmissionReceiptNis: standing.witnesses }));
  }
  return freeze(found);
}

function demandOnboardings(values, demands, { managed = false, bindings = [] } = {}) {
  if (!Array.isArray(values)) throw new TypeError("demandInductionReceipts must be an array");
  if (!Array.isArray(bindings)) throw new TypeError("demandInductionBindings must be an array");
  const selected = new Map();
  for (const binding of bindings) {
    exactNi(binding?.receiptNi, "demandInductionBindings.receiptNi");
    if (!/^0x[0-9a-f]{64}$/u.test(binding.demand ?? "") || selected.has(binding.receiptNi)) throw new TypeError("demand induction bindings require one exact handle per receipt");
    selected.set(binding.receiptNi, binding.demand);
  }
  const byDemand = new Map(), seenRecords = new Set();
  for (const [index, input] of values.entries()) {
    const record = structuredClone(input);
    if (record?.type !== "SemioticExchangeDemandInductionReceipt" || record.version !== 1) throw new TypeError(`demandInductionReceipts[${index}] is not a demand induction receipt v1`);
    exactNi(record.id, `demandInductionReceipts[${index}].id`); exactNi(record.demandNi, `demandInductionReceipts[${index}].demandNi`);
    if (!(record.receiptBytes instanceof Uint8Array)) throw new TypeError(`demandInductionReceipts[${index}].receiptBytes must be canonical RMN bytes`);
    const canonicalRecord = admitJsonSemanticContent({ bytes: record.receiptBytes, token: record.id, objectKind: "semiotic-exchange.SemioticExchangeDemandInductionReceipt" }).value;
    for (const field of ["type", "version", "demandNi", "demandBytes32", "groundingDigest", "wantedLawDigest", "causalGraph", "restrictedArena"]) {
      if (identify(canonicalRecord[field]) !== identify(record[field])) throw new Error(`demand induction ${field} differs from its canonical receipt bytes`);
    }
    const matching = demands.filter((candidate) => same(managed ? candidate.carrierId : candidate.id, record.demandBytes32)
      && candidate.raised.carrierNi === record.demandNi && same(candidate.grounding, record.groundingDigest) && same(candidate.wantedLaw, record.wantedLawDigest));
    const target = selected.get(record.id);
    const demand = target ? matching.find((candidate) => candidate.id === target) : matching.length === 1 ? matching[0] : null;
    if (!demand) throw new Error("demand induction receipt must bind one unambiguous witnessed DemandRaised handle");
    if (!Array.isArray(record.causalGraph) || !Array.isArray(record.restrictedArena)) throw new TypeError("demand induction receipt lacks its settled causal graph and restricted arena");
    if (byDemand.has(demand.id.toLowerCase())) throw new Error("Demand already has an induction receipt");
    byDemand.set(demand.id.toLowerCase(), freeze(record)); seenRecords.add(record.id);
  }
  for (const key of selected.keys()) if (!seenRecords.has(key)) throw new Error("demand induction binding names an absent receipt");
  return byDemand;
}

/** Admit residue-to-demand material without treating off-chain induction as history. */
function capabilityRepairOnboardings(values, { managed = false } = {}) {
  if (!Array.isArray(values)) throw new TypeError("capabilityDemandInductionReceipts must be an array");
  const byDemand = new Map();
  for (const [index, input] of values.entries()) {
    const record = structuredClone(input);
    if (record?.type !== "CapabilityRepairDemandInductionReceipt" || record.version !== 1) throw new TypeError(`capabilityDemandInductionReceipts[${index}] is not a capability repair induction receipt v1`);
    for (const field of ["id", "demandNi", "groundingNi", "wantedLawNi", "residueNi", "inputNi"]) exactNi(record[field], `capabilityDemandInductionReceipts[${index}].${field}`);
    if (!/^0x[0-9a-fA-F]{64}$/u.test(record.demandBytes32 ?? "") || !/^0x[0-9a-fA-F]{64}$/u.test(record.groundingDigest ?? "") || !/^0x[0-9a-fA-F]{64}$/u.test(record.wantedLawDigest ?? "")) throw new TypeError(`capabilityDemandInductionReceipts[${index}] lacks exact SXC coordinates`);
    if (!(record.receiptBytes instanceof Uint8Array)) throw new TypeError(`capabilityDemandInductionReceipts[${index}].receiptBytes must be canonical RMN bytes`);
    const canonical = admitJsonSemanticContent({ bytes: record.receiptBytes, token: record.id, objectKind: "semiotic-exchange.CapabilityRepairDemandInductionReceipt" }).value;
    for (const field of ["type", "version", "raiser", "demandNi", "demandBytes32", "groundingNi", "groundingDigest", "wantedLawNi", "wantedLawDigest", "residueNi", "inputNi", "refusalWitnessNis", "market", "raiseDemand"]) if (identify(canonical[field]) !== identify(record[field])) throw new Error(`capability repair induction ${field} differs from its canonical receipt bytes`);
    if (managed) {
      exactManagedAccount(record.raiser.toLowerCase(), "induction.raiser");
      if (niDigestHex(record.demandNi) !== record.demandBytes32.toLowerCase()) throw new Error("induction carrier digest differs from demandNi");
      if (!Array.isArray(record.raiseDemand?.args) || record.raiseDemand.operation !== "raiseDemand" || record.raiseDemand.args.length !== 3
        || !/^0x(?:[0-9a-f]{2})+$/u.test(record.raiseDemand.args[0])) throw new Error("induction lacks its exact raiseDemand arguments");
      const carrier = Uint8Array.from(record.raiseDemand.args[0].slice(2).match(/../gu), (byte) => Number.parseInt(byte, 16));
      if (makeNiUri(carrier) !== record.demandNi || !same(record.raiseDemand.args[1], record.groundingDigest) || !same(record.raiseDemand.args[2], record.wantedLawDigest)) throw new Error("induction call arguments differ from canonical demand coordinates");
    }
    const key = managed ? `${record.raiser.toLowerCase()}:${record.demandBytes32.toLowerCase()}:${record.groundingDigest.toLowerCase()}:${record.wantedLawDigest.toLowerCase()}` : record.demandBytes32.toLowerCase();
    if (byDemand.has(key)) throw new Error("capability repair demand was inducted twice");
    byDemand.set(key, freeze(record));
  }
  return byDemand;
}
function inducedDemand(onboarding, demands, managed) {
  const matches = demands.filter((candidate) => same(managed ? candidate.carrierId : candidate.id, onboarding.demandBytes32)
    && (!managed || same(candidate.raiser, onboarding.raiser) && same(candidate.grounding, onboarding.groundingDigest) && same(candidate.wantedLaw, onboarding.wantedLawDigest)));
  if (matches.length > 1) throw new Error("capability induction is ambiguous across governed Demand handles");
  return matches[0] ?? null;
}
function capabilityMetabolism(onboardings, demands, offers, federationHistory, managed = false) {
  return freeze([...onboardings.entries()].map(([key, onboarding]) => {
    const demand = inducedDemand(onboarding, demands, managed);
    if (demand && (!same(demand.raiser, onboarding.raiser) || !same(demand.wantedLaw, onboarding.wantedLawDigest) || !same(demand.grounding, onboarding.groundingDigest) || demand.raised.carrierNi !== onboarding.demandNi)) throw new Error("capability repair induction is displaced from its witnessed DemandRaised move");
    const demandOffers = demand === null ? [] : offers.filter((offer) => same(offer.demand, demand.id));
    const attempts = [];
    for (const standing of federationHistory) {
      const attempt = standing.object;
      if (attempt?.type !== "CapabilityProviderAttemptReceipt" || attempt.version !== 1 || !same(attempt.demand, managed ? demand?.id : onboarding.demandBytes32)) continue;
      const offer = demandOffers.find((candidate) => same(candidate.id, attempt.offer));
      if (!offer || !same(offer.controller, attempt.provider) || !["refused", "completed"].includes(attempt.outcome)) throw new Error("capability provider attempt is not grounded in a witnessed offer");
      if (attempt.outcome === "refused") {
        exactNi(attempt.residueNi, "capability provider refusal.residueNi");
        if (!standing.support.negative) throw new Error("capability provider refusal requires negative support");
      } else {
        exactNi(attempt.outputReceiptNi, "capability provider completion.outputReceiptNi");
        if (!/^0x[0-9a-fA-F]{64}$/u.test(attempt.result ?? "") || !standing.support.positive) throw new Error("capability provider completion requires result and positive support");
      }
      attempts.push(freeze({ ...attempt, evidenceNi: standing.objectNi, federationCarrierAdmissionReceiptNis: standing.witnesses, charge: standing.support.value }));
    }
    const accepted = managed ? demand?.receiving : demand?.settlement;
    const closes = Boolean(accepted && attempts.some((attempt) => attempt.outcome === "completed" && same(attempt.result, accepted.result) && same(attempt.offer, demand.purchase?.offer)));
    return freeze({ type: "CapabilityRepairDemandLocus", id: managed ? demand?.id ?? onboarding.id : key,
      ...(managed ? { profile: MARSH_EXCHANGE_PROFILE, demand: demand?.id ?? null, demandBytes32: onboarding.demandBytes32, exchangePhase: demand?.phase ?? null, submission: demand?.submission ?? null, receiving: demand?.receiving ?? null } : {}),
      demandNi: onboarding.demandNi, residueNi: onboarding.residueNi, inputNi: onboarding.inputNi, wantedLaw: onboarding.wantedLawDigest, market: onboarding.market,
      phase: closes ? "succeeded" : demand === null ? "ready-to-raise" : managed && demand.submission ? "submitted" : demand.purchase ? "purchased" : "open",
      grayDegree: closes ? "stable" : "active", obstruction: closes ? null : freeze({ residueNi: onboarding.residueNi, reason: demand === null ? "demand-not-yet-witnessed-on-chain" : managed ? "no-requester-received-matching-provider-result" : "no-positive-settled-provider-receipt" }),
      raiseDemand: demand === null ? onboarding.raiseDemand : null, offers: freeze(demandOffers.map((offer) => freeze({ id: offer.id, cell: offer.cell, provider: offer.controller, phase: offer.purchase ? "purchased" : "offered" }))), attempts: freeze(attempts) });
  }));
}
function canonicalAuthorityRecord(record, objectKind) {
  if (!record || !isNiUri(record.id)) return false;
  const { id, ...body } = record;
  try { return identifyJsonSemanticContent({ objectKind, value: body, witnessRoot: EMPTY_WITNESS_ROOT }).token === id; }
  catch { return false; }
}
function authorityPair(action, authorityRecords) {
  const ucans = authorityRecords?.ucan ?? [], bindings = authorityRecords?.controllerBindings ?? [];
  if (!Array.isArray(ucans) || !Array.isArray(bindings)) throw new TypeError("authorityReceipts must contain ucan and controllerBindings arrays");
  const ability = OPERATION_ABILITY[action.operation], managed = action.profile === MARSH_EXCHANGE_PROFILE;
  const resource = managed ? `did:pkh:${action.chainId}:${action.actor}` : null;
  for (const ucan of ucans) {
    if (!(ucan?.type === "UcanInvocationVerificationReceipt" && ucan.version === 1 && ucan.disposition === "authorized"
      && ucan.revocationStatus === "active" && ucan.capability?.can === ability && isNiUri(ucan.id))) continue;
    if (managed && (!canonicalAuthorityRecord(ucan, "animating.ucan-semantic-material")
      || identifyJsonSemanticContent({ objectKind: "animating.ucan-semantic-material", value: ucan.capability, witnessRoot: EMPTY_WITNESS_ROOT }).token !== ucan.capabilityNi || ucan.capability.with !== resource
      || ucan.capability.nb?.marshProfile !== MARSH_EXCHANGE_PROFILE || ucan.capability.nb?.marshExchange !== action.exchange
      || ucan.capability.nb?.marshActionId !== action.id)) continue;
    const binding = bindings.find((record) => record?.type === "EnterpriseAccountControllerBindingReceipt" && record.version === 1
      && record.disposition === "bound" && record.protocol === "ERC-1271" && isNiUri(record.id)
      && record.controller === ucan.controller && record.actor === ucan.actor && record.invocationCid === ucan.invocationCid
      && record.delegationCid === ucan.delegationCid && record.capabilityNi === ucan.capabilityNi && isNiUri(ucan.capabilityNi)
      && same(record.resource, ucan.capability?.with)
      && (!managed || canonicalAuthorityRecord(record, "ethereum.enterprise-account-controller-binding")
        && record.account === action.actor && record.chain === action.chainId && record.resource === resource
        && record.rmnSemanticDigest === action.actionDigest && identify(record.capability) === identify(ucan.capability)));
    if (binding) return freeze({ ucanInvocationVerificationReceiptNi: ucan.id, enterpriseAccountControllerBindingReceiptNi: binding.id });
  }
  return null;
}

function validateMissionLaw(value) {
  if (value === null) return null;
  if (value?.type !== "ModeledUnionMissionLawLocus" || value.locus !== "law:semiotic-foam-one-machine" || value.language !== "rmn/v2" || !isNiUri(value.carrierNi)) {
    throw new TypeError("missionLaw must be the canonical RMN v2 Semiotic Foam One Machine law locus");
  }
  return freeze({ type: value.type, locus: value.locus, carrierNi: value.carrierNi, language: value.language });
}

function projectWorkspaceContentFoam(validations) {
  const values = [...validations.values()].filter(({ carrier }) => carrier.type === "WorkspaceContentGraph");
  if (values.length === 0) return null;
  if (values.length > 1) throw new Error("more than one workspace content graph was admitted");
  const validation = values[0], graph = validation.carrier.value;
  if (graph?.type !== "WorkspaceContentGraph" || graph.version !== 3
    || !Array.isArray(graph.packages) || !Array.isArray(graph.resources) || !Array.isArray(graph.relations)
    || !Array.isArray(graph.glossaryUtteranceReadouts) || !Array.isArray(graph.glossaryRefusals) || !Array.isArray(graph.glossaryOverlaps)) {
    throw new TypeError("WorkspaceContentGraph v3 admission is malformed");
  }
  const { id, ...body } = graph;
  const canonical = identifyJsonSemanticContent({ objectKind: "typed-resource-catalog.workspace-content-graph", value: body, witnessRoot: EMPTY_WITNESS_ROOT }).token;
  if (canonical !== id) throw new Error("WorkspaceContentGraph differs from its addressed semantic body");
  const relations = graph.relations.map((edge, index) => {
    const sourceRelationNi = exactNi(edge.id, `WorkspaceContentGraph.relations[${index}].id`);
    const subject = required(edge.subject, `WorkspaceContentGraph.relations[${index}].subject`);
    const predicate = required(edge.predicate, `WorkspaceContentGraph.relations[${index}].predicate`);
    const object = required(edge.object, `WorkspaceContentGraph.relations[${index}].object`);
    if (edge.kind !== "workspace.oriented-relation.carrier" || edge.version !== 1 || !Array.isArray(edge.witnessIdentifiers)) {
      throw new TypeError(`WorkspaceContentGraph.relations[${index}] is not an oriented relation carrier v1`);
    }
    for (const forbidden of ["positiveWitnesses", "negativeWitnesses", "positive", "negative", "coordinates", "reading", "witnessRoot"]) {
      if (Object.hasOwn(edge, forbidden)) {
        throw new TypeError(`WorkspaceContentGraph.relations[${index}] carries forbidden inferred semantics ${forbidden}`);
      }
    }
    const addressedCarrier = freeze({
      kind: edge.kind,
      version: 1,
      subject,
      predicate,
      object,
      witnessIdentifiers: structuredClone(edge.witnessIdentifiers),
    });
    const canonical = identifyJsonSemanticContent({
      objectKind: "workspace.oriented-relation",
      value: addressedCarrier,
      witnessRoot: EMPTY_WITNESS_ROOT,
    }).token;
    if (canonical !== sourceRelationNi) throw new Error(`WorkspaceContentGraph.relations[${index}] differs from its addressed carrier`);
    const keptCarrierData = { witnessIdentifiers: structuredClone(edge.witnessIdentifiers) };
    return freeze({ type: "WorkspaceContentRelationProjection", id: sourceRelationNi, from: subject, predicate, to: object, retainedCarrierData: keptCarrierData });
  });
  const packageLoci = graph.packages.map((pkg) => {
    exactNi(pkg.id, `${pkg.name}.apex`);
    const packageRelations = relations.filter(({ from }) => from === pkg.actor);
    return freeze({ type: "MiaotangPackageActorLocus", id: pkg.actor, apexNi: pkg.id, release: pkg.release, operation: pkg.contract?.operation ?? null, phase: "observed", relations: freeze(packageRelations) });
  });
  const resourceLoci = graph.resources.map((resource) => freeze({ type: "SemioticContentLocus", id: exactNi(resource.semanticNi, `${resource.path}.semanticNi`), contentKind: resource.kind, path: resource.path, artifactNi: exactNi(resource.source.ni, `${resource.path}.artifactNi`) }));
  const predicationLoci = graph.glossaryUtteranceReadouts.map((report, index) => freeze({
    type: "WorkspacePredicationGeneratorLocus",
    id: exactNi(report.id, `WorkspaceContentGraph.glossaryUtteranceReadouts[${index}].id`),
    termNi: exactNi(report.termNi, `WorkspaceContentGraph.glossaryUtteranceReadouts[${index}].termNi`),
    articulationReceiptNi: exactNi(report.articulationReceiptNi, `WorkspaceContentGraph.glossaryUtteranceReadouts[${index}].articulationReceiptNi`),
    predicationGeneratorsNi: exactNi(report.predicationGeneratorsNi, `WorkspaceContentGraph.glossaryUtteranceReadouts[${index}].predicationGeneratorsNi`),
    predicationGenerators: structuredClone(report.predicationGenerators),
    correspondence: structuredClone(report.correspondence),
  }));
  return freeze({ type: "WorkspaceContentFoam", version: 3, graphNi: graph.id, admissionReceiptNi: validation.id, loci: freeze([...packageLoci, ...resourceLoci, ...predicationLoci]), predicationLoci: freeze(predicationLoci), relations: freeze(relations) });
}

/** Reconstruct one MUD from monotone SemioticExchange history plus admitted evidence. */
export function createModeledUnionDimension({ witnessed, events = witnessed, chainId, exchange, profile, carrierAdmissions: carrierValidations = [], federationHistory = [], demandInductionReceipts: demandOnboardingRecords = [], demandInductionBindings: demandOnboardingBindings = [], capabilityDemandInductionReceipts: capabilityDemandOnboardingRecords = [], authorityReceipts: authorityRecords = {}, observerFamily = null, missionLaw = null, actuator = null, deploymentActuator = null, notebookQueryReceipts: notebookQueryRecords = [], notebookQueryActuator = null, notebookQueryAvailability = null } = {}) {
  if (!Array.isArray(events)) throw new TypeError("events must be an array of witnessed SemioticExchange moves");
  required(chainId, "chainId"); required(exchange, "exchange");
  profile ??= events[0]?.profile ?? LEGACY_EXCHANGE_PROFILE;
  if (![MARSH_EXCHANGE_PROFILE, LEGACY_EXCHANGE_PROFILE].includes(profile)) throw new TypeError("unknown exchange history profile");
  const managed = profile === MARSH_EXCHANGE_PROFILE;
  const managedHistory = managed ? replayManagedExchange(events, { chainId, exchange }) : null;
  if (!managed && events.some((event) => event?.profile !== undefined && event.profile !== LEGACY_EXCHANGE_PROFILE)) throw new Error("legacy and managed histories cannot be mixed");
  const validations = validateCarriers(carrierValidations), validatedFederationHistory = validateFederationHistory(federationHistory);
  const ordered = managed ? managedHistory.ordered : events.map((event) => freeze({ ...structuredClone(event), profile: LEGACY_EXCHANGE_PROFILE }));
  authorityRecords = freeze(structuredClone(authorityRecords));
  const territoryValidations = [...validations.values()].filter(({ carrier }) => carrier.type === "NodeWorkspaceSourceCatalogReceipt");
  if (territoryValidations.length > 1) throw new Error("more than one canonical codebase territory was admitted");
  if (observerFamily !== null && territoryValidations.length !== 1) throw new Error("observerFamily requires exactly one admitted NodeWorkspaceSourceCatalogReceipt");
  const territoryFoam = observerFamily === null ? null : projectTerritoryFoam({ territoryAdmission: territoryValidations[0], observerFamily });
  const contentFoam = projectWorkspaceContentFoam(validations);
  const validatedMissionLaw = validateMissionLaw(missionLaw);
  const notebookCatalogValidations = [...validations.values()].filter(({ carrier }) => carrier.type === "NotebookLMLibraryCatalogReceipt");
  const lSpace = notebookCatalogValidations.length === 0 ? null : projectLSpace({ catalogAdmissions: notebookCatalogValidations, queryReceipts: notebookQueryRecords, queryActuator: notebookQueryActuator, queryAvailability: notebookQueryAvailability });
  for (let index = 0; !managed && index < ordered.length; index += 1) {
    const event = ordered[index];
    if (!KINDS.includes(event?.kind)) throw new TypeError(`events[${index}] is not a SemioticExchange move`);
    if (!event.chainPosition || event.chainPosition.blockNumber === undefined || !Number.isInteger(event.chainPosition.logIndex)) throw new TypeError(`events[${index}] has no exact chain position`);
    if (index > 0 && !before(ordered[index - 1], event)) throw new Error("SemioticExchange history is not in strict chain order");
  }
  const cells = managedHistory?.cells ?? [], demands = managedHistory?.demands ?? [], offers = managedHistory?.offers ?? [], relations = managedHistory?.relations ?? [];
  for (const event of managed ? [] : ordered) {
    if (event.kind === "CellSeated") {
      if (find(cells, "id", event.cell)) throw new Error(`cell ${event.cell} was seated twice`);
      cells.push({ type: "SemioticCellLocus", id: event.cell, controller: event.controller, law: event.law, seated: event, retired: null });
    } else if (event.kind === "CellRetired") {
      const cell = find(cells, "id", event.cell);
      if (!cell || cell.retired) throw new Error(`retirement does not name one active seated cell ${event.cell}`);
      if (!same(cell.controller, event.controller)) throw new Error(`retirement controller does not hold cell ${event.cell}`);
      cell.retired = event; relations.push(relation("retires", `event:${chainKey(event)}`, `cell:${cell.id}`, event));
    } else if (event.kind === "DemandRaised") {
      if (find(demands, "id", event.demand)) throw new Error(`demand ${event.demand} was raised twice`);
      demands.push({ type: "SemioticDemandLocus", id: event.demand, raiser: event.raiser, wantedLaw: event.wantedLaw, grounding: event.grounding, raised: event, purchase: null, settlement: null });
    } else if (event.kind === "DemandOffered") {
      const demand = find(demands, "id", event.demand), cell = find(cells, "id", event.cell);
      if (!demand) throw new Error(`offer precedes demand ${event.demand}`);
      if (!cell || cell.retired) throw new Error(`offer does not name one active cell ${event.cell}`);
      if (demand.purchase) throw new Error(`offer follows the purchase of demand ${event.demand}`);
      if (find(offers, "id", event.offer)) throw new Error(`offer ${event.offer} was emitted twice`);
      if (!same(cell.controller, event.controller)) throw new Error(`offer controller does not hold cell ${event.cell}`);
      if (!same(cell.law, demand.wantedLaw)) throw new Error(`cell ${event.cell} does not bear wanted law ${demand.wantedLaw}`);
      offers.push({ type: "SemioticOfferLocus", id: event.offer, demand: demand.id, cell: cell.id, controller: event.controller, offered: event, purchase: null });
      relations.push(relation("offersFor", `offer:${event.offer}`, `demand:${demand.id}`, event)); relations.push(relation("offersCell", `offer:${event.offer}`, `cell:${cell.id}`, event));
    } else if (event.kind === "PurchaseMoved") {
      const demand = find(demands, "id", event.demand), offer = find(offers, "id", event.offer), cell = find(cells, "id", event.cell);
      if (!demand || !offer || !cell || cell.retired) throw new Error("purchase references an absent or retired locus");
      if (demand.purchase || offer.purchase) throw new Error(`demand ${event.demand} was purchased twice`);
      if (!same(offer.demand, demand.id) || !same(offer.cell, cell.id)) throw new Error("purchase references a displaced offer");
      if (!same(demand.raiser, event.raiser) || !same(cell.controller, event.controller) || !same(offer.controller, event.controller)) throw new Error("purchase roles do not match the witnessed loci");
      demand.purchase = event; offer.purchase = event; relations.push(relation("purchaseMove", `demand:${demand.id}`, `cell:${cell.id}`, event));
    } else {
      const demand = find(demands, "id", event.demand), cell = find(cells, "id", event.cell);
      if (!demand || !cell || !demand.purchase || demand.settlement) throw new Error(`settlement is not enabled for demand ${event.demand}`);
      if (!same(demand.purchase.cell, cell.id) || !same(cell.controller, event.controller)) throw new Error("settlement is displaced from the purchased cell");
      demand.settlement = event; relations.push(relation("settles", `cell:${cell.id}`, `demand:${demand.id}`, event)); relations.push(relation("resultsIn", `demand:${demand.id}`, event.result, event));
    }
  }
  const onboardings = demandOnboardings(demandOnboardingRecords, demands, { managed, bindings: demandOnboardingBindings });
  const capabilityOnboardings = capabilityRepairOnboardings(capabilityDemandOnboardingRecords, { managed });
  const capabilityDemands = capabilityMetabolism(capabilityOnboardings, demands, offers, validatedFederationHistory, managed);
  const workCirculation = projectWorkCirculation({ admissions: validations, demands, offers, federationHistory: validatedFederationHistory });
  const codexToolObservations = projectCodexToolObservations({ admissions: validations });
  const loci = freeze([
    ...cells.map((cell) => ({ ...cell, phase: cell.retired ? "retired" : "seated", support: support(cell.id, validatedFederationHistory) })),
    ...demands.map((demand) => ({ ...demand, phase: managed ? demand.phase : demand.settlement ? "settled" : demand.purchase ? "purchased" : "raised", support: support(demand.id, validatedFederationHistory), inductionReceiptNi: onboardings.get(demand.id.toLowerCase())?.id ?? null })),
    ...offers.map((offer) => ({ ...offer, phase: offer.purchase ? "purchased" : "offered", support: support(offer.id, validatedFederationHistory) })),
  ]);
  const eventRelations = ordered.slice(1).map((event, index) => relation("causallyFollows", `event:${chainKey(event)}`, `event:${chainKey(ordered[index])}`, event));

  function restrictedArena(actor) {
    required(actor, "actor"); if (managed) exactManagedAccount(actor);
    const candidates = [];
    for (const [key, onboarding] of capabilityOnboardings) if (!inducedDemand(onboarding, demands, managed) && same(onboarding.raiser, actor)) {
      candidates.push({ operation: "raiseDemand", ...(managed ? { demandBytes32: onboarding.demandBytes32, grounding: onboarding.groundingDigest, wantedLaw: onboarding.wantedLawDigest, args: [...onboarding.raiseDemand.args], carrierRequired: false } : { demand: key }), carrierNi: onboarding.demandNi, raiseDemand: onboarding.raiseDemand, capabilityDemandInductionReceiptNi: onboarding.id });
    }
    for (const cell of cells.filter((candidate) => !candidate.retired && same(candidate.controller, actor))) {
      candidates.push({ operation: "retireCell", cell: cell.id, ...(managed ? { expectedSequence: cell.resourceState.sequence, args: [cell.id, cell.resourceState.sequence], carrierRequired: false } : {}) });
      for (const demand of demands.filter((candidate) => !candidate.purchase && !candidate.settlement && same(candidate.wantedLaw, cell.law))) {
        // A managed Offer is a carrier/joins identity: a later distinct Offer
        // from this reusable Cell is permitted while the Demand remains Open.
        if (!managed && offers.some((offer) => same(offer.demand, demand.id) && same(offer.cell, cell.id))) continue;
        const validation = workCirculation.qualification(actor, demand.id);
        if (validation !== null && !validation.qualified) continue;
        candidates.push({ operation: "offerDemand", demand: demand.id, cell: cell.id,
          ...(managed ? { expectedDemandSequence: demand.resourceState.sequence, expectedCellSequence: cell.resourceState.sequence, args: [demand.id, demand.resourceState.sequence, cell.id, cell.resourceState.sequence], carrierRequired: true } : {}),
          ...(validation?.evidence ? { workQualificationEvidenceNi: validation.evidence.evidenceNi } : {}) });
      }
    }
    for (const demand of demands.filter((candidate) => !candidate.purchase && same(candidate.raiser, actor))) {
      for (const offer of offers.filter((candidate) => same(candidate.demand, demand.id) && !candidate.purchase)) {
        const cell = find(cells, "id", offer.cell);
        if (managed && (!cell || cell.retired)) continue;
        candidates.push({ operation: "purchaseMove", demand: demand.id, offer: offer.id, cell: offer.cell,
          ...(managed ? { expectedDemandSequence: demand.resourceState.sequence, expectedCellSequence: cell.resourceState.sequence, args: [demand.id, demand.resourceState.sequence, offer.id, cell.resourceState.sequence], carrierRequired: false } : {}) });
      }
    }
    for (const demand of demands.filter((candidate) => candidate.purchase)) {
      const cell = find(cells, "id", demand.purchase.cell);
      if (managed) {
        if (demand.phase === "Selected" && cell && same(cell.controller, actor)) candidates.push({ operation: "submitDemandResult", demand: demand.id, offer: demand.purchase.offer, cell: cell.id, expectedSequence: demand.resourceState.sequence, args: [demand.id, demand.resourceState.sequence, demand.purchase.offer], carrierRequired: true });
        if (demand.phase === "Submitted" && same(demand.raiser, actor)) candidates.push({ operation: "receiveDemand", demand: demand.id, offer: demand.purchase.offer, cell: demand.purchase.cell, result: demand.submission.result, expectedSequence: demand.resourceState.sequence, args: [demand.id, demand.resourceState.sequence, demand.purchase.offer, demand.submission.result], carrierRequired: true });
      } else if (!demand.settlement && cell && same(cell.controller, actor)) candidates.push({ operation: "settleDemand", demand: demand.id, cell: cell.id });
    }
    for (const [demandId, onboarding] of onboardings) for (const move of onboarding.restrictedArena) {
      const graph = onboarding.causalGraph.find(({ id }) => id === move.prerequisite);
      if (move.evidenceSide !== "positive" || graph?.blockedBy?.length) continue;
      candidates.push({ operation: move.prerequisite === "private-live-mud" ? "deployPrivateLiveMud" : "admitPrerequisiteEvidence", demand: demandId, prerequisite: move.prerequisite, postcondition: move.postcondition, completionWitness: move.completionWitness, demandInductionReceiptNi: onboarding.id, ...(managed ? { args: [], carrierRequired: false } : {}) });
    }
    const actions = candidates.map((candidate) => {
      const context = managed ? { profile, profileId: MARSH_EXCHANGE_PROFILE_ID, chainId, exchange,
        checkpoint: managedHistory.checkpoint, historyNi: managedHistory.historyNi,
        observedResources: [...new Set([candidate.cell, candidate.demand, candidate.offer].filter(Boolean))].sort().map((resource) => managedHistory.resources.get(resource)).filter(Boolean) } : {};
      const identity = { type: "RestrictedModeledUnionAction", actor, ...context, ...candidate };
      const identified = managed ? identifyManagedAction(identity) : { id: identify(identity) };
      const action = { type: "SemioticExchangeAction", ...context, actor, ...candidate, ...identified, polarity: "positive" };
      if (candidate.operation === "deployPrivateLiveMud") return { ...action, available: typeof deploymentActuator === "function", ...(typeof deploymentActuator === "function" ? {} : { unavailability: "private-deployment-actuator-unavailable" }), evidence: { demandInductionReceiptNi: candidate.demandInductionReceiptNi } };
      if (candidate.operation === "admitPrerequisiteEvidence") return { ...action, available: false, unavailability: "canonical-evidence-observation-required", evidence: { demandInductionReceiptNi: candidate.demandInductionReceiptNi } };
      const pair = authorityPair(action, authorityRecords), relevantNis = [...new Set([
        candidate.carrierNi,
        candidate.cell && find(cells, "id", candidate.cell)?.seated.carrierNi,
        candidate.demand && find(demands, "id", candidate.demand)?.raised.carrierNi,
        candidate.offer && find(offers, "id", candidate.offer)?.offered.carrierNi,
        managed && candidate.operation === "receiveDemand" && find(demands, "id", candidate.demand)?.submission.carrierNi,
      ].filter(Boolean))];
      const carrierRecordNis = relevantNis.map((ni) => validations.get(ni)?.id).filter(Boolean);
      const fullyValidated = carrierRecordNis.length === relevantNis.length;
      const available = fullyValidated && pair !== null && typeof actuator === "function";
      return { ...action, available,
        ...(!fullyValidated ? { unavailability: "carrier-admission-required" } : !pair ? { unavailability: "authority-receipts-required" } : typeof actuator !== "function" ? { unavailability: managed ? "managed-exchange-actuator-unavailable" : "zero-custody-append-actuator-unavailable" } : {}),
        evidence: { carrierAdmissionReceiptNis: freeze(carrierRecordNis), ...(pair ?? {}) } };
    });
    return freeze({ type: "RestrictedModeledUnionArena", actor, ...(managed ? { profile, chainId, exchange, checkpoint: managedHistory.checkpoint, historyNi: managedHistory.historyNi } : {}), actions });
  }

  async function actuate(actionId, actor, input = {}) {
    const action = restrictedArena(actor).actions.find(({ id }) => id === actionId);
    if (!action) throw Object.assign(new Error("action is not in the actor's current restricted arena"), { code: "MUD_ACTION_NOT_RESTRICTED", status: 403 });
    if (!action.available) throw Object.assign(new Error(action.unavailability), { code: "MUD_ACTION_UNAVAILABLE", status: 409 });
    if (action.operation === "deployPrivateLiveMud") return deploymentActuator(action);
    return actuator(action, input);
  }
  function restrictedWorkArena(actor) {
    const workDemandIds = new Set(workCirculation.workLoci.map(({ id }) => String(id).toLowerCase()));
    const actions = restrictedArena(actor).actions.filter((action) => action.demand && workDemandIds.has(String(action.demand).toLowerCase()));
    return freeze({ type: "RestrictedUnionWorkArena", actor, actions: freeze(actions) });
  }
  const projectedLoci = freeze([
    ...loci,
    ...(territoryFoam === null ? [] : territoryFoam.sections.map((section) => ({ ...section, type: "CodebaseTerritoryActorLocus", id: section.locus, sectionNi: section.id }))),
    ...(contentFoam === null ? [] : contentFoam.loci),
    ...capabilityDemands,
    ...workCirculation.loci,
    ...codexToolObservations,
    ...workCirculation.workLoci.flatMap((location) => location.cultivation),
    ...(lSpace === null ? [] : lSpace.presentation.loci),
  ]);
  const projectedRelations = freeze([...relations, ...eventRelations, ...workCirculation.relations, ...(territoryFoam?.relations ?? []), ...(contentFoam?.relations ?? [])]);
  return freeze({ actor: ACTOR, restrictedArena, restrictedWorkArena, actuate,
    restrictedLSpaceArena: (actor, request) => lSpace === null ? freeze({ type: "RestrictedLSpaceArena", actor, actions: [] }) : lSpace.restrictedArena(actor, request),
    queryLSpace: async (request) => { if (lSpace === null) throw Object.assign(new Error("no witnessed L-space catalog is admitted"), { code: "MUD_LSPACE_UNAVAILABLE", status: 409 }); return lSpace.query(request); },
    induceUnboundCodexToolBindingDemands: ({ raiser, induceDemand }) => induceUnboundCodexToolBindingDemands({ raiser, observationLoci: codexToolObservations, induceDemand }),
    presentation: () => freeze({ type: "ModeledUnionDimensionPresentation", version: managed ? 8 : 7, ledger: { profile, chainId, exchange, ...(managed ? { profileId: MARSH_EXCHANGE_PROFILE_ID, checkpoint: managedHistory.checkpoint, historyNi: managedHistory.historyNi } : {}) }, missionLaw: validatedMissionLaw, events: ordered, loci: projectedLoci, relations: projectedRelations, territoryFoam, contentFoam, lSpace: lSpace?.presentation ?? null, workCirculation: { loci: workCirculation.loci, operation: "project-work-circulation" }, capabilityDemandMetabolism: capabilityDemands, carrierAdmissionReceiptNis: freeze([...validations.values()].map(({ id }) => id)), federationCarrierAdmissionReceiptNis: freeze(validatedFederationHistory.flatMap(({ witnesses }) => witnesses)), demandInductionReceiptNis: freeze([...onboardings.values()].map(({ id }) => id)), capabilityDemandInductionReceiptNis: freeze([...capabilityOnboardings.values()].map(({ id }) => id)), x402SettlementEvidence: settlementEvidence(validatedFederationHistory) }),
    loci: () => projectedLoci, relations: () => projectedRelations, territoryFoam: () => territoryFoam, contentFoam: () => contentFoam, lSpace: () => lSpace?.presentation ?? null, codexToolObservations: () => freeze({ type: "CodexToolObservationPresentation", version: 1, providerCell: "urn:ame:codex-session-activity-provider:tool-observation", loci: codexToolObservations, authority: { observation: true, execution: false, restrictedMove: false, actuatorBinding: false, outcomeAssertion: false } }), workCirculation: () => freeze({ type: "WorkCirculationPresentation", version: 1, loci: workCirculation.loci, relations: workCirculation.relations }) });
}
