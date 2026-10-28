import type { PracticeAttempt, PracticeAttemptInput, PracticeImportResult, PracticeNotebook, PracticeScenario, PracticeSubmission } from '../../types/practice';
import { evaluateAttempt, REASONING_MAX_LENGTH } from './evaluation';
import { PRACTICE_SCENARIOS } from './scenarios';

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
export const MAX_PRACTICE_ATTEMPTS = 200;
export const MAX_SUBMISSIONS = 100;
export const MAX_NOTES_LENGTH = 10000;
const emptyNotebook = (): PracticeNotebook => ({ version: 2, attempts: [] });
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const boundedText = (value: unknown, limit: number): value is string => typeof value === 'string' && value.length <= limit;
const isDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
};
const validIds = (value: unknown, scenario: PracticeScenario): value is string[] => Array.isArray(value) && value.length <= 100 &&
  value.every((id) => typeof id === 'string' && scenario.diagnostics.some((item) => item.id === id));

const validateInput = (value: unknown, scenario: PracticeScenario): PracticeAttemptInput | null => {
  if (!isRecord(value)) return null;
  const hypothesisId = value.hypothesisId;
  if (hypothesisId !== null && hypothesisId !== '' && !scenario.hypotheses.some((item) => item.id === hypothesisId)) return null;
  if (!validIds(value.diagnosticIds, scenario) || !validIds(value.citedDiagnosticIds, scenario)) return null;
  if (!value.citedDiagnosticIds.every((id) => (value.diagnosticIds as string[]).includes(id))) return null;
  if (!boundedText(value.reasoning, REASONING_MAX_LENGTH)) return null;
  return { hypothesisId: hypothesisId as string | null, diagnosticIds: [...new Set(value.diagnosticIds)],
    citedDiagnosticIds: [...new Set(value.citedDiagnosticIds)], reasoning: value.reasoning };
};

const validateAttempt = (value: unknown): PracticeAttempt | null => {
  if (!isRecord(value)) return null;
  const scenario = PRACTICE_SCENARIOS.find((item) => item.id === value.scenarioId);
  if (!scenario || value.scenarioVersion !== scenario.version) return null;
  if (typeof value.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value.id)) return null;
  if (!isDate(value.createdAt) || !isDate(value.updatedAt) || value.updatedAt < value.createdAt) return null;
  if (!boundedText(value.notes, MAX_NOTES_LENGTH) || !Number.isInteger(value.hintCount) || (value.hintCount as number) < 0 || (value.hintCount as number) > scenario.hints.length) return null;
  const draft = validateInput(value, scenario);
  if (!draft || !Array.isArray(value.submissions) || value.submissions.length > MAX_SUBMISSIONS) return null;
  const submissions: PracticeSubmission[] = [];
  let previous = value.createdAt;
  for (const candidate of value.submissions) {
    if (!isRecord(candidate) || !isDate(candidate.submittedAt) || candidate.submittedAt < previous || candidate.submittedAt > value.updatedAt) return null;
    const input = validateInput(candidate, scenario);
    if (!input) return null;
    submissions.push({ ...input, submittedAt: candidate.submittedAt });
    previous = candidate.submittedAt;
  }
  return { ...draft, id: value.id, scenarioId: scenario.id, scenarioVersion: scenario.version,
    createdAt: value.createdAt, updatedAt: value.updatedAt, notes: value.notes, hintCount: value.hintCount as number, submissions };
};

export const createPracticeAttempt = (scenario: PracticeScenario, id: string, now: string): PracticeAttempt => ({
  id, scenarioId: scenario.id, scenarioVersion: scenario.version, createdAt: now, updatedAt: now,
  hypothesisId: null, diagnosticIds: [], citedDiagnosticIds: [], reasoning: '', notes: '', hintCount: 0, submissions: [],
});

export const submitPracticeAttempt = (attempt: PracticeAttempt, now: string): PracticeAttempt => {
  const valid = validateAttempt(attempt);
  if (!valid || valid.submissions.length >= MAX_SUBMISSIONS || !isDate(now) || now < valid.updatedAt) return attempt;
  const snapshot: PracticeSubmission = { hypothesisId: valid.hypothesisId, diagnosticIds: [...valid.diagnosticIds],
    citedDiagnosticIds: [...valid.citedDiagnosticIds], reasoning: valid.reasoning, submittedAt: now };
  return { ...valid, updatedAt: now, submissions: [...valid.submissions, snapshot] };
};

const migrateLegacy = (value: unknown): PracticeAttempt | null => {
  if (!isRecord(value) || !isDate(value.updatedAt)) return null;
  const scenario = PRACTICE_SCENARIOS.find((item) => item.id === value.scenarioId);
  if (!scenario) return null;
  return validateAttempt({ ...createPracticeAttempt(scenario, `legacy:${scenario.id}:${value.updatedAt}`, value.updatedAt),
    hypothesisId: value.hypothesisId, diagnosticIds: value.diagnosticIds });
};

const byteSize = (value: unknown): number => new TextEncoder().encode(JSON.stringify(value)).byteLength;
const withinSize = (notebook: PracticeNotebook): boolean => byteSize(notebook) <= MAX_IMPORT_BYTES;

const mergeSession = (existing: PracticeAttempt, incoming: PracticeAttempt, allowEqual: boolean): PracticeAttempt | null => {
  if (existing.scenarioId !== incoming.scenarioId || existing.scenarioVersion !== incoming.scenarioVersion || existing.createdAt !== incoming.createdAt) return null;
  if (allowEqual && incoming.updatedAt < existing.updatedAt) return null;
  const submissions = [...existing.submissions];
  const fingerprints = new Set(submissions.map((item) => JSON.stringify(item)));
  let addedHistory = false;
  for (const item of incoming.submissions) {
    const key = JSON.stringify(item);
    if (!fingerprints.has(key)) { submissions.push(item); fingerprints.add(key); addedHistory = true; }
  }
  if (submissions.length > MAX_SUBMISSIONS) return null;
  if (!allowEqual && incoming.updatedAt <= existing.updatedAt && !addedHistory) return null;
  const scenario = PRACTICE_SCENARIOS.find((item) => item.id === existing.scenarioId)!;
  submissions.sort((left, right) => {
    const chronological = left.submittedAt.localeCompare(right.submittedAt);
    if (chronological || allowEqual) return chronological;
    // Different devices can submit at the same timestamp. Preserve both;
    // incomplete checks sort last so a merge cannot grant an ambiguous pass.
    const completion = Number(evaluateAttempt(scenario, right).complete) - Number(evaluateAttempt(scenario, left).complete);
    const leftKey = JSON.stringify(left);
    const rightKey = JSON.stringify(right);
    return completion || (leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0);
  });
  const draft = incoming.updatedAt > existing.updatedAt || allowEqual ? incoming : existing;
  return { ...draft, submissions };
};

const mergeAttempt = (notebook: PracticeNotebook, incoming: PracticeAttempt, allowEqual: boolean): PracticeNotebook | null => {
  const index = notebook.attempts.findIndex((item) => item.id === incoming.id);
  if (index < 0) return notebook.attempts.length < MAX_PRACTICE_ATTEMPTS ? { version: 2, attempts: [...notebook.attempts, incoming] } : null;
  const combined = mergeSession(notebook.attempts[index], incoming, allowEqual);
  if (!combined) return null;
  const attempts = [...notebook.attempts];
  attempts[index] = combined;
  return { version: 2, attempts };
};

const normalizeNotebook = (value: unknown): PracticeNotebook => {
  const notebook = emptyNotebook();
  if (!isRecord(value) || value.version !== 2 || !Array.isArray(value.attempts)) return notebook;
  const sessions = new Map<string, PracticeAttempt>();
  for (const candidate of value.attempts) {
    const attempt = validateAttempt(candidate);
    if (!attempt) continue;
    const existing = sessions.get(attempt.id);
    if (existing) sessions.set(attempt.id, mergeSession(existing, attempt, false) ?? existing);
    else if (sessions.size < MAX_PRACTICE_ATTEMPTS) sessions.set(attempt.id, attempt);
  }
  // Count each serialized session once; repeatedly serializing a growing notebook
  // would make every draft keystroke quadratic in the amount of saved history.
  let bytes = byteSize(notebook);
  for (const attempt of sessions.values()) {
    const addedBytes = byteSize(attempt) + (notebook.attempts.length ? 1 : 0);
    if (bytes + addedBytes > MAX_IMPORT_BYTES) continue;
    notebook.attempts.push(attempt);
    bytes += addedBytes;
  }
  return notebook;
};

export const importNotebook = (raw: string, current: PracticeNotebook): PracticeImportResult => {
  let notebook = normalizeNotebook(current);
  const failure = (error: string): PracticeImportResult => ({ notebook, importedCount: 0, skippedCount: 0, error });
  if (typeof raw !== 'string' || raw.length > MAX_IMPORT_BYTES || new TextEncoder().encode(raw).byteLength > MAX_IMPORT_BYTES) return failure('Import exceeds the 2 MB size limit.');
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return failure('This file is not valid JSON. No imported data was saved.'); }
  if (!isRecord(parsed) || !Array.isArray(parsed.attempts)) return failure('Notebook must contain a version and an attempts array.');
  if (parsed.version !== 1 && parsed.version !== 2) return failure('Unsupported notebook version. Only versions 1 and 2 can be imported.');
  let importedCount = 0;
  let skippedCount = 0;
  for (const candidate of parsed.attempts) {
    const attempt = parsed.version === 1 ? migrateLegacy(candidate) : validateAttempt(candidate);
    const merged = attempt ? mergeAttempt(notebook, attempt, false) : null;
    if (!merged || !withinSize(merged)) { skippedCount++; continue; }
    notebook = merged;
    importedCount++;
  }
  return { notebook, importedCount, skippedCount };
};

export const parseNotebook = (raw: string | null): PracticeNotebook => raw ? importNotebook(raw, emptyNotebook()).notebook : emptyNotebook();
export const serializeNotebook = (notebook: PracticeNotebook): string => JSON.stringify(normalizeNotebook(notebook));
export const exportNotebookJson = serializeNotebook;
export const upsertAttemptWithResult = (notebook: PracticeNotebook, attempt: PracticeAttempt): { notebook: PracticeNotebook; accepted: boolean; error?: string } => {
  const normalized = normalizeNotebook(notebook);
  const valid = validateAttempt(attempt);
  if (!valid) return { notebook: normalized, accepted: false, error: 'This edit has invalid data or exceeds a field or submission limit. Shorten the input and try again.' };
  const merged = mergeAttempt(normalized, valid, true);
  if (!merged) return { notebook: normalized, accepted: false, error: 'This session could not be saved: the notebook is full, the history limit is reached, or newer session data already exists.' };
  if (!withinSize(merged)) return { notebook: normalized, accepted: false, error: 'The notebook reached its 2 MB limit. Export a backup, then shorten notes or remove an old session before saving.' };
  return { notebook: merged, accepted: true };
};
export const upsertAttempt = (notebook: PracticeNotebook, attempt: PracticeAttempt): PracticeNotebook => upsertAttemptWithResult(notebook, attempt).notebook;
