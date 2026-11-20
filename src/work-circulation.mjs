import { isNiUri } from "@red-cup-engineering/uri-engineering-services-section/ni-uri";
import { EMPTY_WITNESS_ROOT, identifyJsonSemanticContent } from "@red-cup-engineering/computer-code-engine/semiotic-expression-notation/semantic-content-identity";

import { MARSH_EXCHANGE_PROFILE } from "./managed-exchange.mjs";

const IDENTIFIER = /^[a-z0-9]+(?:[-.:/][a-z0-9]+)*$/u;

function required(value, label) {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${label} must be a non-empty string`);
  return value;
}
function identifier(value, label) {
  required(value, label);
  if (!IDENTIFIER.test(value)) throw new TypeError(`${label} must be a canonical identifier`);
  return value;
}
function exactNi(value, label) {
  if (!isNiUri(value)) throw new TypeError(`${label} must be a canonical SHA-256 ni identifier`);
  return value;
}
function same(left, right) { return String(left).toLowerCase() === String(right).toLowerCase(); }
function freeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}
function identify(value, objectKind = `modeled-union-dimension.${value?.type ?? "material"}`) {
  return identifyJsonSemanticContent({ objectKind, value, witnessRoot: EMPTY_WITNESS_ROOT }).token;
}
function uniqueIdentifiers(values, label) {
  if (!Array.isArray(values)) throw new TypeError(`${label} must be an array`);
  return freeze([...new Set(values.map((value, index) => identifier(value, `${label}[${index}]`)))].sort());
}

/**
 * The canonical carrier for a unit of work.  It carries the whole descent, so a
 * demand is never a detached status-string or a private queue entry.
 */
export function createWorkCarrier({ endeavor, project, milestone, duty, qualification: validation = {}, evidenceNis = [] } = {}) {
  if (endeavor === null || typeof endeavor !== "object" || Array.isArray(endeavor)) throw new TypeError("endeavor must be an object");
  if (project === null || typeof project !== "object" || Array.isArray(project)) throw new TypeError("project must be an object");
  if (milestone === null || typeof milestone !== "object" || Array.isArray(milestone)) throw new TypeError("milestone must be an object");
  if (duty === null || typeof duty !== "object" || Array.isArray(duty)) throw new TypeError("duty must be an object");
  const normalized = freeze({
    type: "UnionWorkCarrier",
    version: 1,
    endeavor: { id: identifier(endeavor.id, "endeavor.id") },
    project: { id: identifier(project.id, "project.id"), endeavor: identifier(project.endeavor, "project.endeavor") },
    milestone: { id: identifier(milestone.id, "milestone.id"), project: identifier(milestone.project, "milestone.project") },
    duty: { id: identifier(duty.id, "duty.id"), office: identifier(duty.office, "duty.office") },
    qualification: {
      ranks: uniqueIdentifiers(validation.ranks ?? [], "qualification.ranks"),
      cohorts: uniqueIdentifiers(validation.cohorts ?? [], "qualification.cohorts"),
      capabilities: uniqueIdentifiers(validation.capabilities ?? [], "qualification.capabilities"),
    },
    evidenceNis: freeze([...new Set(evidenceNis.map((value, index) => exactNi(value, `evidenceNis[${index}]`)))].sort()),
  });
  if (normalized.project.endeavor !== normalized.endeavor.id) throw new Error("project must descend from this endeavor");
  if (normalized.milestone.project !== normalized.project.id) throw new Error("milestone must descend from this project");
  return freeze({ type: "UnionWorkCarrier", value: normalized });
}

function validateWorkCarrier(validation) {
  if (validation?.carrier?.type !== "UnionWorkCarrier") return null;
  const carrier = createWorkCarrier(validation.carrier.value);
  if (identify(validation.version === 2 ? carrier.value : carrier, `semiotic-exchange.${carrier.type}`) !== validation.contentNi) throw new Error("UnionWorkCarrier admission does not match its canonical identity");
  return freeze({ carrierNi: validation.contentNi, admissionReceiptNi: validation.id, work: carrier.value });
}

function validationFor(actor, work, standings) {
  const validations = [];
  for (const standing of standings) {
    const claim = standing.object;
    if (claim?.type !== "WorkQualificationClaim" || claim.version !== 1 || !standing.support?.positive || !same(claim.actor, actor)) continue;
    identifier(claim.office, "WorkQualificationClaim.office");
    const rank = identifier(claim.rank, "WorkQualificationClaim.rank");
    const cohorts = uniqueIdentifiers(claim.cohorts ?? [], "WorkQualificationClaim.cohorts");
    const duties = uniqueIdentifiers(claim.duties ?? [], "WorkQualificationClaim.duties");
    const capabilities = uniqueIdentifiers(claim.capabilities ?? [], "WorkQualificationClaim.capabilities");
    validations.push(freeze({ evidenceNi: standing.objectNi, rank, cohorts, duties, capabilities, office: claim.office }));
  }
  const required = work.qualification;
  const match = validations.find((value) => value.office === work.duty.office
    && value.duties.includes(work.duty.id)
    && (required.ranks.length === 0 || required.ranks.includes(value.rank))
    && required.cohorts.every((cohort) => value.cohorts.includes(cohort))
    && required.capabilities.every((capability) => value.capabilities.includes(capability)));
  return freeze({ qualified: Boolean(match), evidence: match ?? null });
}

function workAttempts(demand, work, offers, standings) {
  const attempts = [];
  for (const standing of standings) {
    const attempt = standing.object;
    if (attempt?.type !== "WorkAssignmentAttemptReceipt" || attempt.version !== 1 || !same(attempt.demand, demand.id)) continue;
    if (!same(attempt.duty, work.duty.id) || !same(attempt.office, work.duty.office)) throw new Error("work assignment attempt differs from its work carrier");
    if (!["refused", "completed"].includes(attempt.outcome)) throw new TypeError("work assignment outcome must be refused or completed");
    const offer = offers.find((candidate) => same(candidate.id, attempt.offer));
    if (!offer || !same(offer.demand, demand.id) || !same(offer.controller, attempt.actor)) throw new Error("work assignment attempt is not grounded in a witnessed offer");
    if (attempt.outcome === "refused") {
      exactNi(attempt.residueNi, "WorkAssignmentAttemptReceipt.residueNi");
      if (!standing.support.negative) throw new Error("work refusal requires negative federation support");
    } else {
      exactNi(attempt.outputReceiptNi, "WorkAssignmentAttemptReceipt.outputReceiptNi");
      if (!/^0x[0-9a-fA-F]{64}$/u.test(attempt.result ?? "") || !standing.support.positive) throw new Error("completed work requires positive result support");
    }
    attempts.push(freeze({ ...attempt, evidenceNi: standing.objectNi, federationCarrierAdmissionReceiptNis: standing.witnesses, charge: standing.support.value }));
  }
  return freeze(attempts);
}

/** Produce a reusable, unraised SXC demand carrier from a witnessed work refusal. */
export function deriveCultivationDemandCarrier({ workLocus: workLocation, refusal: rejection }) {
  if (workLocation?.type !== "UnionWorkLocus") throw new TypeError("workLocus must be a UnionWorkLocus");
  if (rejection?.outcome !== "refused") throw new TypeError("refusal must be a refused WorkAssignmentAttemptReceipt");
  exactNi(rejection.residueNi, "refusal.residueNi");
  return freeze({ type: "UnionCultivationDemandCarrier", value: freeze({
    type: "UnionCultivationDemandCarrier", version: 1,
    parentWorkLocus: workLocation.id,
    endeavor: workLocation.endeavor,
    project: workLocation.project,
    milestone: workLocation.milestone,
    requiredOffice: workLocation.duty.office,
    requiredDuty: workLocation.duty.id,
    qualification: workLocation.qualification,
    residueNi: rejection.residueNi,
    sourceAttemptNi: rejection.evidenceNi,
    market: "union-officer-academy/formation-lianqun",
  }) });
}

/**
 * Interpret admitted work carriers and federated evidence over witnessed SXC
 * moves.  This is the Rendanheyi path: user demand descends into an office duty;
 * Huidu Guanli stays visible as held positive/negative evidence, never a queue.
 */
export function projectWorkCirculation({ admissions: validations, demands, offers, federationHistory }) {
  const carriers = new Map();
  for (const validation of validations.values()) {
    const validated = validateWorkCarrier(validation);
    if (validated !== null) carriers.set(validated.carrierNi, validated);
  }
  const loci = [];
  const relations = [];
  for (const demand of demands) {
    const validated = carriers.get(demand.raised.carrierNi);
    if (!validated) continue;
    const work = validated.work;
    const attempts = workAttempts(demand, work, offers, federationHistory);
    const managed = demand.profile === MARSH_EXCHANGE_PROFILE;
    const accepted = managed ? demand.receiving : demand.settlement;
    const completed = attempts.find((attempt) => attempt.outcome === "completed" && accepted && same(attempt.result, accepted.result) && same(attempt.offer, demand.purchase?.offer));
    const rejections = attempts.filter((attempt) => attempt.outcome === "refused");
    const location = freeze({
      type: "UnionWorkLocus", id: demand.id, demandNi: validated.carrierNi, workCarrierAdmissionReceiptNi: validated.admissionReceiptNi,
      ...(managed ? { profile: MARSH_EXCHANGE_PROFILE, carrierId: demand.carrierId, exchangePhase: demand.phase, selectedOffer: demand.purchase?.offer ?? null,
        submission: demand.submission, receiving: demand.receiving,
        acceptance: demand.receiving === null ? null : { actor: demand.raiser, result: demand.receiving.result, receipt: demand.receiving.receipt, chainPosition: demand.receiving.chainPosition },
        completionEvidenceNi: completed?.evidenceNi ?? null } : { settlementInterpretation: "legacy-provider-settlement" }),
      endeavor: work.endeavor, project: work.project, milestone: work.milestone, duty: work.duty, qualification: work.qualification,
      phase: completed ? "settled" : demand.purchase ? "engaged" : "open",
      grayDegree: completed ? "stable" : rejections.length > 0 ? "active" : "absurd",
      attempts,
      cultivation: freeze(rejections.map((rejection) => freeze({ type: "UnionCultivationDemandLocus", id: identify(deriveCultivationDemandCarrier({ workLocus: { type: "UnionWorkLocus", id: demand.id, endeavor: work.endeavor, project: work.project, milestone: work.milestone, duty: work.duty, qualification: work.qualification }, refusal: rejection })), sourceAttemptNi: rejection.evidenceNi, phase: "ready-to-raise", carrier: deriveCultivationDemandCarrier({ workLocus: { type: "UnionWorkLocus", id: demand.id, endeavor: work.endeavor, project: work.project, milestone: work.milestone, duty: work.duty, qualification: work.qualification }, refusal: rejection }) }))),
    });
    loci.push(location);
    relations.push(freeze({ type: "realizesEndeavor", from: `work:${demand.id}`, to: `endeavor:${work.endeavor.id}` }));
    relations.push(freeze({ type: "belongsToProject", from: `work:${demand.id}`, to: `project:${work.project.id}` }));
    relations.push(freeze({ type: "advancesMilestone", from: `work:${demand.id}`, to: `milestone:${work.milestone.id}` }));
    relations.push(freeze({ type: "borneAsDuty", from: `work:${demand.id}`, to: `office:${work.duty.office}/duty:${work.duty.id}` }));
  }
  const milestones = new Map(), projects = new Map(), endeavors = new Map();
  for (const location of loci) {
    const milestone = milestones.get(location.milestone.id) ?? { ...location.milestone, workIds: [] };
    if (milestone.project !== location.project.id) throw new Error("one milestone cannot belong to two projects");
    milestone.workIds.push(location.id); milestones.set(milestone.id, milestone);
    const project = projects.get(location.project.id) ?? { ...location.project, milestoneIds: [] };
    if (project.endeavor !== location.endeavor.id) throw new Error("one project cannot belong to two endeavors");
    if (!project.milestoneIds.includes(location.milestone.id)) project.milestoneIds.push(location.milestone.id);
    projects.set(project.id, project);
    endeavors.set(location.endeavor.id, { ...location.endeavor });
  }
  function aggregatePhase(children) {
    if (children.length > 0 && children.every((child) => child.phase === "settled")) return freeze({ phase: "settled", grayDegree: "stable" });
    if (children.some((child) => child.phase === "engaged")) return freeze({ phase: "engaged", grayDegree: children.some((child) => child.grayDegree === "active") ? "active" : "absurd" });
    return freeze({ phase: "open", grayDegree: children.some((child) => child.grayDegree === "active") ? "active" : "absurd" });
  }
  const milestoneLoci = [...milestones.values()].sort((a, b) => a.id.localeCompare(b.id)).map((milestone) => freeze({ type: "UnionMilestoneLocus", id: milestone.id, project: milestone.project, workIds: freeze([...milestone.workIds].sort()), ...aggregatePhase(loci.filter((location) => milestone.workIds.includes(location.id))) }));
  const projectLoci = [...projects.values()].sort((a, b) => a.id.localeCompare(b.id)).map((project) => freeze({ type: "UnionProjectLocus", id: project.id, endeavor: project.endeavor, milestoneIds: freeze([...project.milestoneIds].sort()), ...aggregatePhase(milestoneLoci.filter((location) => project.milestoneIds.includes(location.id))) }));
  const endeavorLoci = [...endeavors.values()].sort((a, b) => a.id.localeCompare(b.id)).map((endeavor) => freeze({ type: "UnionEndeavorLocus", id: endeavor.id, projectIds: freeze(projectLoci.filter((project) => project.endeavor === endeavor.id).map((project) => project.id).sort()), ...aggregatePhase(projectLoci.filter((project) => project.endeavor === endeavor.id)) }));
  function validation(actor, demandId) {
    const location = loci.find((value) => same(value.id, demandId));
    return location === undefined ? null : validationFor(actor, location, federationHistory);
  }
  return freeze({ loci: freeze([...loci, ...milestoneLoci, ...projectLoci, ...endeavorLoci]), workLoci: freeze(loci), relations: freeze(relations), qualification: validation });
}
