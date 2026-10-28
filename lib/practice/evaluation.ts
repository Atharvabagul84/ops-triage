import type { PracticeAttempt, PracticeAttemptInput, PracticeEvaluation, PracticeScenario } from '../../types/practice';

export const REASONING_MIN_LENGTH = 40;
export const REASONING_MAX_LENGTH = 4000;

export const evaluateAttempt = (scenario: PracticeScenario, input: PracticeAttemptInput): PracticeEvaluation => {
  const inspected = new Set(input.diagnosticIds);
  const cited = new Set(input.citedDiagnosticIds);
  const known = new Set(scenario.diagnostics.map((item) => item.id));
  const correct = input.hypothesisId === scenario.correctHypothesisId;
  const hasRequiredEvidence = scenario.requiredDiagnosticIds.every((id) => inspected.has(id));
  const hasCitedEvidence = scenario.requiredDiagnosticIds.every((id) => cited.has(id)) &&
    [...cited].every((id) => inspected.has(id) && known.has(id));
  const length = input.reasoning.trim().length;
  const hasReasoning = length >= REASONING_MIN_LENGTH && length <= REASONING_MAX_LENGTH;
  const checks = [
    { label: 'Supported diagnosis selected', passed: correct },
    { label: 'Required diagnostics inspected', passed: hasRequiredEvidence },
    { label: 'Required evidence explicitly cited', passed: hasCitedEvidence },
    { label: 'Reasoning provided (40–4,000 characters; presence only)', passed: hasReasoning },
  ];
  const complete = checks.every((item) => item.passed);
  const feedback: string[] = [];
  if (!correct) feedback.push(scenario.hypotheses.find((item) => item.id === input.hypothesisId)?.feedback ?? 'Select a hypothesis to assess.');
  if (!hasRequiredEvidence) feedback.push('Inspect the required diagnostic evidence before completing this case.');
  if (!hasCitedEvidence) feedback.push('Explicitly cite the required diagnostics; citations must refer to evidence you inspected.');
  if (!hasReasoning) feedback.push('Write 40–4,000 characters explaining your diagnosis and uncertainty.');
  if (complete) feedback.push('Supported diagnosis with the required evidence. Review the debrief and recovery checks.');
  feedback.push('Reasoning presence and length are checked, not semantic correctness.');
  return { correct, hasRequiredEvidence, hasCitedEvidence, hasReasoning, complete, checks, feedback: feedback.join(' ') };
};

export const getAttemptEvaluation = (scenario: PracticeScenario, attempt: PracticeAttempt): PracticeEvaluation => {
  const latest = attempt.submissions.at(-1);
  if (latest) return evaluateAttempt(scenario, latest);
  return { ...evaluateAttempt(scenario, { hypothesisId: null, diagnosticIds: [], citedDiagnosticIds: [], reasoning: '' }),
    feedback: 'No diagnosis submitted. Draft changes are not assessed.' };
};
