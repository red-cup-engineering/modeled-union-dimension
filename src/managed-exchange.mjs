import { isNiUri, makeNiUri, niUriDigestBytes } from "@red-cup-engineering/uri-services-section/ni-uri";
import { EMPTY_WITNESS_ROOT, identifyJsonSemanticContent } from "@red-cup-engineering/computer-data-engineering-services-section/semiotic-expression-notation/semantic-content-identity";

export const MARSH_EXCHANGE_PROFILE = "marsh:exchange:v1";
// SHA-256 of the canonical CBOR text term specified by MARSH E1, not a SEN envelope.
export const MARSH_EXCHANGE_PROFILE_ID = "0x47eada871a98e7139b3f118a26b4e82995d0ed01552733b2cd99e6de4cf03044";
export const LEGACY_EXCHANGE_PROFILE = "legacy:semiotic-exchange:v1";
const ZERO = `0x${"00".repeat(32)}`;
const KINDS = Object.freeze({
  Actor: "0x9a7c27beb93731a3d46a826bb448893f1e792b736ecc24fa43996ca74c8b3530",
  Work: "0x1fcabfc7baee05853e9087275509063b9122adf28de39b3baa4c44c4392b05e2",
  Relation: "0x0f57c204ea7f93c5f817a7e0e02deeb0de84af265777673608c98e9f9967447d",
});
const ADMISSIONS = new Set(["CellSeated", "DemandRaised", "DemandOffered"]);
const MOVES = new Set([...ADMISSIONS, "CellRetired", "PurchaseMoved", "DemandResultSubmitted", "DemandReceived"]);
const CARRIERS = new Set([...ADMISSIONS, "DemandResultSubmitted", "DemandReceived"]);
const DECIMAL = /^(?:0|[1-9][0-9]*)$/u;
const DIGEST = /^0x[0-9a-f]{64}$/u;
const ACCOUNT = /^0x[0-9a-f]{40}$/u;

export function freezeManaged(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value) || ArrayBuffer.isView(value)) return value;
  for (const child of Object.values(value)) freezeManaged(child);
  return Object.freeze(value);
}
export function niDigestHex(ni) {
  if (!isNiUri(ni)) throw new TypeError("a canonical SHA-256 ni is required");
  return `0x${Array.from(niUriDigestBytes(ni), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
export function exactManagedAccount(value, label = "actor") {
  if (!ACCOUNT.test(value ?? "") || value === `0x${"00".repeat(20)}`) throw new TypeError(`${label} must be a nonzero lowercase EVM account`);
  return value;
}
function digest(value, label, nonzero = false) {
  if (!DIGEST.test(value ?? "") || nonzero && value === ZERO) throw new TypeError(`${label} must be a canonical${nonzero ? " nonzero" : ""} bytes32`);
  return value;
}
function decimal(value, label, max = (1n << 256n) - 1n) {
  if (typeof value !== "string" || !DECIMAL.test(value) || BigInt(value) > max) throw new TypeError(`${label} must be a canonical bounded decimal string`);
  return value;
}
function same(actual, expected, label) {
  if (actual !== expected) throw new Error(`managed exchange ${label} mismatch`);
}
function position(value, label) {
  if (!value || typeof value !== "object") throw new TypeError(`${label} is required`);
  decimal(value.blockNumber, `${label}.blockNumber`);
  digest(value.blockHash, `${label}.blockHash`, true); digest(value.transactionHash, `${label}.transactionHash`, true);
  for (const field of ["transactionIndex", "logIndex"]) if (!Number.isSafeInteger(value[field]) || value[field] < 0) throw new TypeError(`${label}.${field} must be a nonnegative safe integer`);
}
function earlier(left, right) {
  const a = BigInt(left.blockNumber), b = BigInt(right.blockNumber);
  return a < b || a === b && left.logIndex < right.logIndex;
}
function identified(value) {
  return identifyJsonSemanticContent({ objectKind: `modeled-union-dimension.${value.type}`, value, witnessRoot: EMPTY_WITNESS_ROOT });
}
export function identifyManagedAction(value) {
  const identity = freezeManaged(structuredClone(value)), result = identified(identity);
  return { actionIdentity: identity, id: result.token, actionDigest: niDigestHex(result.token) };
}
export function managedEventKey(event) {
  return `${event.profile}:${event.chainId}:${event.exchange}:${event.chainPosition.blockHash}:${event.chainPosition.transactionHash}:${event.chainPosition.logIndex}`;
}
function relation(type, from, to, event) {
  return { type, from, to, profile: event.profile, chainId: event.chainId, exchange: event.exchange, chainPosition: event.chainPosition, nativePosition: event.nativePosition, ...(event.carrierNi ? { carrierNi: event.carrierNi } : {}) };
}

/** Independently receive the lifecycle and source coordinates of already
 * authenticated Ethereum reader events. ABI/CBOR hashing, deployed code and
 * finality remain the reader's obligations; they are not invented by this model. */
export function replayManagedExchange(events, { chainId, exchange }) {
  if (!/^eip155:[1-9][0-9]*$/u.test(chainId ?? "") || BigInt(chainId.slice(7)) >= (1n << 256n)) throw new TypeError("managed chainId must be canonical EIP-155 CAIP-2");
  exactManagedAccount(exchange, "exchange");
  const ordered = [], cells = [], demands = [], offers = [], relations = [], resources = new Map();
  const blocks = new Map(), transactions = new Map(), transactionOccurrences = new Map();
  for (const [index, input] of events.entries()) {
    const event = structuredClone(input);
    if (!MOVES.has(event?.kind)) throw new TypeError(`events[${index}] is not a managed exchange move`);
    same(event.profile, MARSH_EXCHANGE_PROFILE, "profile"); same(event.profileId, MARSH_EXCHANGE_PROFILE_ID, "profile identity"); same(event.chainId, chainId, "chain"); same(event.exchange, exchange, "deployment");
    position(event.chainPosition, "chainPosition"); position(event.nativePosition, "nativePosition");
    for (const field of ["blockNumber", "blockHash", "transactionHash", "transactionIndex"]) same(event.nativePosition[field], event.chainPosition[field], `native ${field}`);
    same(event.nativePosition.logIndex + 1, event.chainPosition.logIndex, "adjacent native event");
    if (index && !earlier(ordered[index - 1].chainPosition, event.nativePosition)) throw new Error("managed history is not in strict native/semantic chain order");
    const at = event.chainPosition, occurrence = `${at.blockNumber}:${at.transactionIndex}`;
    if (blocks.has(at.blockNumber)) same(at.blockHash, blocks.get(at.blockNumber), "block occurrence");
    if (transactions.has(occurrence)) same(at.transactionHash, transactions.get(occurrence), "transaction coordinate");
    if (transactionOccurrences.has(at.transactionHash)) same(occurrence, transactionOccurrences.get(at.transactionHash), "transaction occurrence");
    const previous = ordered[index - 1]?.chainPosition;
    if (previous?.blockNumber === at.blockNumber && previous.transactionIndex > at.transactionIndex) throw new Error("managed transaction order is inconsistent");
    blocks.set(at.blockNumber, at.blockHash); transactions.set(occurrence, at.transactionHash); transactionOccurrences.set(at.transactionHash, occurrence);
    for (const field of ["cell", "demand", "offer", "law", "wantedLaw", "grounding", "result", "receipt"]) if (event[field] !== undefined) digest(event[field], field, true);
    for (const field of ["controller", "raiser"]) if (event[field] !== undefined) exactManagedAccount(event[field], field);
    if (CARRIERS.has(event.kind)) {
      digest(event.carrierId, "carrierId", true); same(niDigestHex(event.carrierNi), event.carrierId, "carrier identity");
      if (event.carrier !== undefined) {
        if (!(event.carrier instanceof Uint8Array) || event.carrier.length === 0) throw new TypeError("managed carrier must be nonempty bytes");
        same(makeNiUri(event.carrier), event.carrierNi, "carrier bytes");
        const encoded = `0x${Array.from(event.carrier, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
        if (event.carrierHex !== undefined) same(event.carrierHex, encoded, "carrier hex");
        event.carrierHex = encoded;
      }
      if (event.carrierHex !== undefined) {
        if (!/^0x(?:[0-9a-f]{2})+$/u.test(event.carrierHex)) throw new TypeError("carrierHex must be canonical nonempty bytes");
        const bytes = Uint8Array.from(event.carrierHex.slice(2).match(/../gu), (byte) => Number.parseInt(byte, 16));
        same(makeNiUri(bytes), event.carrierNi, "carrier hex identity");
      }
    } else if (event.carrierId !== undefined || event.carrierNi !== undefined || event.carrier !== undefined || event.carrierHex !== undefined) throw new Error("carrier-free move has unexpected carrier material");
    // Snapshots expose immutable hex, never a mutable typed-array alias.
    delete event.carrier;
    const state = event.resourceState;
    if (!state || typeof state !== "object") throw new TypeError("managed event requires its paired native resourceState");
    for (const field of ["resource", "kind", "content", "evidence"]) digest(state[field], `resourceState.${field}`, true);
    digest(state.priorContent, "resourceState.priorContent"); exactManagedAccount(state.controller, "resourceState.controller");
    decimal(state.sequence, "resourceState.sequence", (1n << 64n) - 1n); decimal(state.priorSequence, "resourceState.priorSequence", (1n << 64n) - 1n);
    const isCell = event.kind === "CellSeated" || event.kind === "CellRetired", isOffer = event.kind === "DemandOffered";
    same(state.resource, isCell ? event.cell : isOffer ? event.offer : event.demand, "semantic/native resource");
    same(state.kind, KINDS[isCell ? "Actor" : isOffer ? "Relation" : "Work"], "resource kind");
    if (!ADMISSIONS.has(event.kind)) same(event.sequence, state.sequence, "semantic/native sequence");
    const prior = resources.get(state.resource);
    if (ADMISSIONS.has(event.kind)) {
      if (prior) throw new Error("managed resource was admitted twice");
      same(state.sequence, "1", "admission sequence"); same(state.priorSequence, "0", "admission prior sequence"); same(state.priorContent, ZERO, "admission prior content");
    } else {
      if (!prior) throw new Error("managed history is missing its resource admission prefix");
      same(state.controller, prior.controller, "persistent controller"); same(state.kind, prior.kind, "persistent kind");
      same(state.priorContent, prior.content, "prior content"); same(state.priorSequence, prior.sequence, "prior sequence");
      same(BigInt(state.sequence), BigInt(prior.sequence) + 1n, "next sequence");
    }
    if (event.kind === "CellSeated") {
      digest(event.law, "Cell law", true); exactManagedAccount(event.controller, "Cell controller"); same(state.controller, event.controller, "Cell owner");
      cells.push({ type: "SemioticCellLocus", profile: MARSH_EXCHANGE_PROFILE, id: event.cell, carrierId: event.carrierId, controller: event.controller, law: event.law, seated: event, retired: null, resourceState: state });
    } else if (event.kind === "CellRetired") {
      const cell = cells.find(({ id }) => id === event.cell);
      if (!cell || cell.retired) throw new Error("managed retirement requires one active Cell");
      same(event.controller, cell.controller, "retirement actor"); cell.retired = event; cell.resourceState = state;
      relations.push(relation("retires", `event:${managedEventKey(event)}`, `cell:${cell.id}`, event));
    } else if (event.kind === "DemandRaised") {
      digest(event.grounding, "Demand grounding", true); digest(event.wantedLaw, "Demand wanted law", true); exactManagedAccount(event.raiser, "Demand raiser"); same(state.controller, event.raiser, "Demand owner");
      demands.push({ type: "SemioticDemandLocus", profile: MARSH_EXCHANGE_PROFILE, id: event.demand, carrierId: event.carrierId, raiser: event.raiser, wantedLaw: event.wantedLaw, grounding: event.grounding, phase: "Open", raised: event, purchase: null, submission: null, receiving: null, resourceState: state });
    } else if (event.kind === "DemandOffered") {
      const demand = demands.find(({ id }) => id === event.demand), cell = cells.find(({ id }) => id === event.cell);
      if (!demand || demand.phase !== "Open" || !cell || cell.retired) throw new Error("managed offer requires open Work and an active Cell");
      same(event.controller, cell.controller, "offering actor"); same(state.controller, cell.controller, "Offer owner"); same(cell.law, demand.wantedLaw, "offer law");
      offers.push({ type: "SemioticOfferLocus", profile: MARSH_EXCHANGE_PROFILE, id: event.offer, carrierId: event.carrierId, demand: demand.id, cell: cell.id, controller: event.controller, offered: event, purchase: null, resourceState: state });
      relations.push(relation("offersFor", `offer:${event.offer}`, `demand:${demand.id}`, event), relation("offersCell", `offer:${event.offer}`, `cell:${cell.id}`, event));
    } else {
      const demand = demands.find(({ id }) => id === event.demand), offer = offers.find(({ id }) => id === event.offer);
      if (!demand || !offer || offer.demand !== demand.id) throw new Error("managed move lacks its exact Demand/Offer join");
      const cell = cells.find(({ id }) => id === offer.cell);
      if (!cell) throw new Error("managed move lacks its provider Cell");
      same(state.controller, demand.raiser, "persistent Work owner");
      if (event.kind === "PurchaseMoved") {
        if (demand.phase !== "Open" || offer.purchase || cell.retired) throw new Error("managed selection requires open Work and an active provider");
        same(event.cell, cell.id, "selected Cell"); same(event.raiser, demand.raiser, "selecting actor"); same(event.controller, cell.controller, "selected provider"); same(cell.law, demand.wantedLaw, "selected law");
        demand.purchase = event; demand.phase = "Selected"; offer.purchase = event;
        relations.push(relation("purchaseMove", `demand:${demand.id}`, `cell:${cell.id}`, event));
      } else {
        if (!demand.purchase) throw new Error("managed move precedes selection");
        same(event.offer, demand.purchase.offer, "exact selected Offer"); same(cell.id, demand.purchase.cell, "exact selected Cell");
        if (event.kind === "DemandResultSubmitted") {
          if (demand.phase !== "Selected") throw new Error("managed submission requires selected Work");
          same(event.cell, cell.id, "submitting Cell"); same(event.controller, cell.controller, "submitting actor"); same(event.result, event.carrierId, "submitted result");
          demand.submission = event; demand.phase = "Submitted";
          relations.push(relation("submitsResult", `cell:${cell.id}`, `demand:${demand.id}`, event), relation("resultsIn", `demand:${demand.id}`, event.result, event));
        } else {
          if (demand.phase !== "Submitted") throw new Error("managed receiving requires submitted Work");
          same(event.raiser, demand.raiser, "receiving actor"); same(event.result, demand.submission.result, "exact submitted result"); same(event.receipt, event.carrierId, "receiving carrier");
          demand.receiving = event; demand.phase = "Received";
          relations.push(relation("receivesResult", `actor:${event.raiser}`, event.result, event), relation("acceptsWork", `actor:${event.raiser}`, `demand:${demand.id}`, event));
        }
      }
      demand.resourceState = state;
    }
    resources.set(state.resource, state); ordered.push(freezeManaged(event));
  }
  const history = { type: "ManagedExchangeHistory", profile: MARSH_EXCHANGE_PROFILE, profileId: MARSH_EXCHANGE_PROFILE_ID, chainId, exchange, events: ordered };
  return { ordered, cells, demands, offers, relations, resources, historyNi: identified(history).token, checkpoint: ordered.at(-1)?.chainPosition ?? null };
}
