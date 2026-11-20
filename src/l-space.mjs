import { createHash } from "node:crypto";
import { readingOfSides } from "@red-cup-engineering/metrologic/four";
import { isNiUri } from "@red-cup-engineering/uri-engineering-services-section/ni-uri";
import { EMPTY_WITNESS_ROOT, identifyJsonSemanticContent } from "@red-cup-engineering/computer-code-engine/semiotic-expression-notation/semantic-content-identity";

const SHA = /^sha256:[a-f0-9]{64}$/u;
export const NOTEBOOK_PROVIDER = "urn:ame:notebooklm-inference-team";

function identify(value) { return identifyJsonSemanticContent({ objectKind: `modeled-union-dimension.${value?.type ?? "material"}`, value, witnessRoot: EMPTY_WITNESS_ROOT }).token; }
function digest(value) { return `sha256:${createHash("sha256").update(value).digest("hex")}`; }
function required(value, label) { if (typeof value !== "string" || value.length === 0) throw new TypeError(`${label} must be a non-empty string`); return value; }
function exactNi(value, label) { if (!isNiUri(value)) throw new TypeError(`${label} must be a canonical SHA-256 ni identifier`); return value; }
function freeze(value) { if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value; for (const child of Object.values(value)) freeze(child); return Object.freeze(value); }
function canonicalBody(value) { const { id: _id, ...body } = value; return body; }

function validateCatalog(validation, index) {
  if (validation?.type !== "CarrierAdmissionReceipt" || validation.version !== 1 || validation.disposition !== "admitted") throw new TypeError(`l-space catalog admission ${index} is not a CarrierAdmissionReceipt v1`);
  exactNi(validation.id, `l-space catalog admission ${index}.id`); exactNi(validation.contentNi, `l-space catalog admission ${index}.contentNi`);
  const catalog = validation.carrier?.value;
  if (validation.carrier?.type !== "NotebookLMLibraryCatalogReceipt" || catalog?.type !== "NotebookLMLibraryCatalogReceipt" || catalog.version !== 1) throw new TypeError(`l-space catalog admission ${index} does not carry a NotebookLMLibraryCatalogReceipt v1`);
  if (catalog.provider !== NOTEBOOK_PROVIDER) throw new TypeError(`l-space catalog admission ${index} has the wrong provider`);
  exactNi(catalog.id, `l-space catalog admission ${index}.catalog.id`);
  if (identify(canonicalBody(catalog)) !== catalog.id) throw new Error(`l-space catalog admission ${index} differs from its canonical identity`);
  if (!Array.isArray(catalog.notebooks)) throw new TypeError(`l-space catalog admission ${index}.notebooks must be an array`);
  return { admission: validation, catalog };
}

function validateNotebook(entry, catalog, validation, ordinal, seen) {
  exactNi(entry?.notebookRefNi, `notebook ${ordinal}.notebookRefNi`); exactNi(entry?.sourceSetNi, `notebook ${ordinal}.sourceSetNi`);
  if (entry.access !== "query") throw new TypeError(`notebook ${ordinal}.access must be query`);
  if (!Array.isArray(entry.sourceReceiptNis) || entry.sourceReceiptNis.length === 0) throw new TypeError(`notebook ${ordinal} must retain its source receipt set`);
  const sourceRecordNis = [...new Set(entry.sourceReceiptNis.map((ni, source) => exactNi(ni, `notebook ${ordinal}.sourceReceiptNis[${source}]`)))].sort();
  if (!Array.isArray(entry.witnessNis) || entry.witnessNis.length === 0) throw new TypeError(`notebook ${ordinal} must retain at least one observation witness`);
  const witnessNis = [...new Set(entry.witnessNis.map((ni, witness) => exactNi(ni, `notebook ${ordinal}.witnessNis[${witness}]`)))].sort();
  const location = `notebook:${entry.notebookRefNi}`;
  if (seen.has(location)) throw new Error(`l-space repeats notebook locus ${location}`); seen.add(location);
  const coordinate = { type: "LSpaceNotebookLocus", id: location, notebookRefNi: entry.notebookRefNi, sourceSetNi: entry.sourceSetNi, sourceCount: sourceRecordNis.length, access: "query" };
  return freeze({ ...coordinate, coordinateNi: identify(coordinate), sourceReceiptNis: sourceRecordNis, witnessPath: { catalogAdmissionReceiptNi: validation.id, catalogReceiptNi: catalog.id, libraryReceiptNi: exactNi(catalog.libraryReceiptNi, "catalog.libraryReceiptNi"), witnessNis } });
}

function validateQueryRecord(record, loci, index) {
  if (record?.type !== "LSpaceNotebookQueryReceipt" || record.version !== 1 || record.disposition !== "answered") throw new TypeError(`l-space query receipt ${index} is not an answered LSpaceNotebookQueryReceipt v1`);
  exactNi(record.id, `l-space query receipt ${index}.id`);
  if (identify(canonicalBody(record)) !== record.id) throw new Error(`l-space query receipt ${index} differs from its canonical identity`);
  const location = loci.find(({ id }) => id === record.notebookLocus);
  if (!location || location.notebookRefNi !== record.notebookRefNi || location.sourceSetNi !== record.sourceSetNi) throw new Error(`l-space query receipt ${index} is displaced from its witnessed notebook locus`);
  if (record.provider !== NOTEBOOK_PROVIDER || record.authority?.truth !== false || record.authority?.mutation !== false || record.authority?.governance !== false) throw new Error(`l-space query receipt ${index} crosses the advisory authority boundary`);
  exactNi(record.providerOperationReceiptNi, `l-space query receipt ${index}.providerOperationReceiptNi`);
  if (!SHA.test(record.query?.digest ?? "") || !Number.isSafeInteger(record.query?.byteLength)) throw new TypeError(`l-space query receipt ${index} has no exact query digest`);
  if (!SHA.test(record.response?.digest ?? "") || digest(record.response.text) !== record.response.digest) throw new Error(`l-space query receipt ${index} response differs from its digest`);
  const citationSet = new Set();
  for (const [citationIndex, citation] of record.citations.entries()) { exactNi(citation.id, `citation ${citationIndex}.id`); exactNi(citation.sourceReceiptNi, `citation ${citationIndex}.sourceReceiptNi`); if (!location.sourceReceiptNis.includes(citation.sourceReceiptNi)) throw new Error("citation escapes the witnessed notebook source set"); citationSet.add(citation.id); }
  for (const [claimIndex, claim] of record.claims.entries()) { exactNi(claim.id, `claim ${claimIndex}.id`); if (!["positive", "negative"].includes(claim.polarity) || !SHA.test(claim.statementDigest ?? "")) throw new TypeError(`claim ${claimIndex} is not typed evidence`); if (!Array.isArray(claim.citationNis) || claim.citationNis.length === 0 || claim.citationNis.some((ni) => !citationSet.has(ni))) throw new Error(`claim ${claimIndex} is not citation-bound`); }
  return freeze(record);
}

export function createLSpaceQueryRecord({ locus: location, question, providerResult }) {
  required(question, "question");
  if (providerResult?.provider !== NOTEBOOK_PROVIDER) throw new TypeError(`providerResult.provider must be ${NOTEBOOK_PROVIDER}`);
  exactNi(providerResult.providerOperationReceiptNi, "providerResult.providerOperationReceiptNi");
  const citations = (providerResult.citations ?? []).map((citation, index) => { const body = { type: "LSpaceCitation", version: 1, sourceReceiptNi: exactNi(citation.sourceReceiptNi, `providerResult.citations[${index}].sourceReceiptNi`), providerCitationDigest: SHA.test(citation.providerCitationDigest ?? "") ? citation.providerCitationDigest : digest(required(citation.providerCitation, `providerResult.citations[${index}].providerCitation`)) }; return freeze({ id: identify(body), ...body }); });
  const citationBySource = new Map(citations.map((citation) => [citation.sourceReceiptNi, citation.id]));
  const claims = (providerResult.claims ?? []).map((claim, index) => { const citationNis = [...new Set((claim.sourceReceiptNis ?? []).map((ni) => citationBySource.get(ni)).filter(Boolean))].sort(); if (citationNis.length === 0) throw new TypeError(`providerResult.claims[${index}] has no admitted citation`); const body = { type: "LSpaceEvidenceClaim", version: 1, polarity: claim.polarity, statementDigest: SHA.test(claim.statementDigest ?? "") ? claim.statementDigest : digest(required(claim.statement, `providerResult.claims[${index}].statement`)), citationNis }; return freeze({ id: identify(body), ...body }); });
  const answer = required(providerResult.answer, "providerResult.answer");
  const queryBytes = Buffer.byteLength(question), body = freeze({ type: "LSpaceNotebookQueryReceipt", version: 1, disposition: "answered", notebookLocus: location.id, notebookRefNi: location.notebookRefNi, sourceSetNi: location.sourceSetNi, query: { digest: digest(question), byteLength: queryBytes }, provider: NOTEBOOK_PROVIDER, providerOperationReceiptNi: providerResult.providerOperationReceiptNi, response: { mediaType: "text/plain", text: answer, digest: digest(answer) }, citations, claims, authority: { truth: false, mutation: false, governance: false, characterization: "source-grounded-provider-advice" } });
  return freeze({ id: identify(body), ...body });
}

/**
 * Bind the inference team's existing askLiveNotebook operation to a MUD actuator.
 * Provider notebook/source locators stay inside the supplied private resolver;
 * only canonical source receipts and a content witness cross this membrane.
 */
export function createNotebookLmLibraryQueryActuator({ askLiveNotebook, resolvePrivateBinding, classifyEvidence = () => [] } = {}) {
  if (typeof askLiveNotebook !== "function") throw new TypeError("askLiveNotebook must be the notebooklm-inference-team operation");
  if (typeof resolvePrivateBinding !== "function") throw new TypeError("resolvePrivateBinding must retain provider locators in private custody");
  if (typeof classifyEvidence !== "function") throw new TypeError("classifyEvidence must be a function");
  return async ({ notebookRefNi, sourceSetNi, sourceReceiptNis: sourceRecordNis, question }) => {
    const binding = await resolvePrivateBinding({ notebookRefNi, sourceSetNi });
    required(binding?.notebookId, "private binding notebookId");
    const sourceBindings = Array.isArray(binding.sourceBindings) ? binding.sourceBindings : [];
    const byProviderReference = new Map(sourceBindings.map(({ providerReference, sourceReceiptNi: sourceRecordNi }) => [required(providerReference, "provider source reference"), exactNi(sourceRecordNi, "private source binding receipt")]));
    const live = await askLiveNotebook({ notebookId: binding.notebookId, question });
    if (live?.type !== "NotebookLMLiveAnswer" || live.authority !== "source-grounded-provider-answer-not-execution-or-governance-authority") throw new Error("notebooklm-inference-team returned no lawful live answer");
    const answer = required(live.answer?.answer, "NotebookLM answer");
    const references = Array.isArray(live.answer?.references) ? live.answer.references : [];
    const citations = references.map((reference) => { const providerReference = typeof reference === "string" ? reference : reference?.source_id ?? reference?.sourceId; const sourceRecordNi = byProviderReference.get(providerReference); if (!sourceRecordNi || !sourceRecordNis.includes(sourceRecordNi)) throw new Error("NotebookLM citation has no receipt-bound source mapping"); return { sourceReceiptNi: sourceRecordNi, providerCitation: JSON.stringify(reference) }; });
    const providerWitness = { type: "NotebookLMLiveQueryOperationWitness", version: 1, notebookRefNi, sourceSetNi, queryDigest: digest(question), answerDigest: digest(answer), citationDigests: citations.map(({ providerCitation }) => digest(providerCitation)), observedAt: required(live.observedAt, "NotebookLM observedAt") };
    const claims = await classifyEvidence({ answer, citations: freeze(citations), providerAnswer: live.answer, sourceReceiptNis: freeze([...sourceRecordNis]) });
    return freeze({ provider: NOTEBOOK_PROVIDER, providerOperationReceiptNi: identify(providerWitness), answer, citations, claims });
  };
}

/** Project admitted notebook/library carriers as L-space; no notebook state or credentials are held here. */
export function projectLSpace({ catalogAdmissions: catalogValidations = [], queryReceipts: queryRecords = [], queryActuator = null, queryAvailability = null } = {}) {
  const seen = new Set(), loci = catalogValidations.flatMap((value, index) => { const { admission: validation, catalog } = validateCatalog(value, index); return catalog.notebooks.map((entry, ordinal) => validateNotebook(entry, catalog, validation, ordinal, seen)); });
  const records = queryRecords.map((record, index) => validateQueryRecord(record, loci, index));
  function support(locationId) { const positiveEvidence = [], negativeEvidence = []; for (const record of records.filter(({ notebookLocus: notebookLocation }) => notebookLocation === locationId)) for (const claim of record.claims) { (claim.polarity === "positive" ? positiveEvidence : negativeEvidence).push({ claimNi: claim.id, queryReceiptNi: record.id, citationNis: claim.citationNis }); } return freeze({ positiveEvidence, negativeEvidence, charge: readingOfSides("knowledge", positiveEvidence.length > 0, negativeEvidence.length > 0) }); }
  const projectedLoci = freeze(loci.map((location) => ({ ...location, support: support(location.id) })));
  function restrictedArena(actor, request = {}) { required(actor, "actor"); const location = projectedLoci.find(({ id }) => id === request.locus); if (!location || typeof request.question !== "string" || request.question.length === 0) return freeze({ type: "RestrictedLSpaceArena", actor, actions: [] }); const obstruction = queryAvailability?.available === false ? required(queryAvailability.obstruction, "queryAvailability.obstruction") : typeof queryActuator !== "function" ? "notebooklm-query-actuator-unavailable" : null; const candidate = { type: "LSpaceQueryMove", operation: "queryNotebook", actor, locus: location.id, queryDigest: digest(request.question), provider: NOTEBOOK_PROVIDER, sourceSetNi: location.sourceSetNi }; const action = { ...candidate, id: identify(candidate), available: obstruction === null, ...(obstruction === null ? {} : { unavailability: obstruction }), evidence: { notebookCoordinateNi: location.coordinateNi, catalogAdmissionReceiptNi: location.witnessPath.catalogAdmissionReceiptNi, sourceSetNi: location.sourceSetNi } }; return freeze({ type: "RestrictedLSpaceArena", actor, actions: [action] }); }
  async function query({ actor, locus: locationId, question }) { const action = restrictedArena(actor, { locus: locationId, question }).actions[0]; if (!action) throw Object.assign(new Error("query is not at a witnessed L-space locus"), { code: "MUD_LSPACE_QUERY_NOT_RESTRICTED", status: 403 }); if (!action.available) throw Object.assign(new Error(action.unavailability), { code: "MUD_LSPACE_QUERY_UNAVAILABLE", status: 409 }); const location = projectedLoci.find(({ id }) => id === locationId); let result; try { result = await queryActuator({ action, notebookRefNi: location.notebookRefNi, sourceSetNi: location.sourceSetNi, sourceReceiptNis: location.sourceReceiptNis, question }); } catch (error) { throw Object.assign(new Error(`NotebookLM query failed: ${error.message}`), { code: "MUD_LSPACE_PROVIDER_FAILURE", status: 502, cause: error }); } return validateQueryRecord(createLSpaceQueryRecord({ locus: location, question, providerResult: result }), projectedLoci, "provider"); }
  const body = freeze({ type: "LSpacePresentation", version: 1, provider: NOTEBOOK_PROVIDER, loci: projectedLoci, queryReceiptNis: records.map(({ id }) => id), authority: { catalogs: "discovery-and-coordinate-evidence-only", queryResults: "advisory-only", sourceContentsDisclosed: false } });
  return freeze({ presentation: freeze({ ...body, id: identify(body) }), restrictedArena, query });
}
