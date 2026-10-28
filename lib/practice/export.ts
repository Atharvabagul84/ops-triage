import type { PracticeAttempt, PracticeAttemptInput, PracticeNotebook, PracticeScenario } from '../../types/practice';
import { evaluateAttempt, getAttemptEvaluation } from './evaluation';
import { parseNotebook, serializeNotebook } from './notebook';
import { PRACTICE_SCENARIOS } from './scenarios';

const section = (title: string, lines: string[]): string => `### ${title}\n\n${lines.map((line) => `- ${line}`).join('\n')}\n`;
const textBlock = (value: string): string => {
  const fence = '`'.repeat(Math.max(3, ...[...value.matchAll(/`+/g)].map((match) => match[0].length + 1)));
  return `${fence}text\n${value || '(none)'}\n${fence}\n`;
};

const describeInput = (scenario: PracticeScenario, input: PracticeAttemptInput): string => {
  const hypothesis = scenario.hypotheses.find((item) => item.id === input.hypothesisId)?.label ?? 'Not selected';
  const labels = (ids: string[]) => ids.map((id) => scenario.diagnostics.find((item) => item.id === id)?.label ?? id).join('; ') || 'None';
  return `Selected hypothesis: ${hypothesis}\n\nInspected diagnostics: ${labels(input.diagnosticIds)}\n\nCited diagnostics: ${labels(input.citedDiagnosticIds)}\n\nReasoning (learner-authored; semantic correctness is not assessed):\n\n${textBlock(input.reasoning)}`;
};

const exportAttempt = (scenario: PracticeScenario, attempt: PracticeAttempt): string => {
  const evaluation = getAttemptEvaluation(scenario, attempt);
  const collectedIds = new Set([...attempt.diagnosticIds, ...attempt.submissions.flatMap((item) => item.diagnosticIds)]);
  const diagnostics = scenario.diagnostics.filter((item) => collectedIds.has(item.id));
  const parts = [
    `## ${scenario.title}\n`,
    `Session: ${attempt.id} | Scenario version: ${attempt.scenarioVersion}\n\nCreated: ${attempt.createdAt}\n\nUpdated: ${attempt.updatedAt}\n`,
    `Status: ${evaluation.complete ? 'Completed practice case (latest submission)' : 'In progress — latest submission not completed'}\n`,
    `Hints revealed: ${attempt.hintCount}\n`,
    ...(attempt.hintCount ? [section('Revealed hints', scenario.hints.slice(0, attempt.hintCount))] : []),
    `### Personal notes\n\n${textBlock(attempt.notes)}`,
    `### Initial observations (simulated)\n\n${textBlock(scenario.initialEvidence)}`,
    '### Submission timeline\n',
    ...(attempt.submissions.length ? attempt.submissions.map((item, index) => {
      const result = evaluateAttempt(scenario, item);
      return `#### Submission ${index + 1} — ${item.submittedAt}\n\nResult: ${result.complete ? 'Completed' : 'Not completed'}\n\n${describeInput(scenario, item)}\n${result.feedback}\n`;
    }) : ['No submitted diagnosis.\n']),
    `### Draft (not assessed)\n\n${describeInput(scenario, attempt)}`,
    '### Collected diagnostics (simulated)\n',
    diagnostics.length ? diagnostics.map((item) => `#### ${item.label}\n\n${textBlock(item.command)}\n${textBlock(item.output)}\n${item.explanation}\n`).join('\n') : 'No diagnostics collected.\n',
  ];
  if (evaluation.complete) parts.push(`### Supported conclusion\n\n${scenario.debrief.cause}\n`,
    section('Supporting evidence', scenario.debrief.evidence), section('Counter-evidence and uncertainty', scenario.debrief.counterEvidence),
    section('Remediation to review', scenario.debrief.remediation), section('Recovery verification', scenario.debrief.verification),
    `### Lesson\n\n${scenario.debrief.lesson}\n`);
  parts.push(section('References', scenario.sources.map((source) => `[${source.title}](${source.url})`)));
  return parts.join('\n');
};

export const exportNotebookMarkdown = (notebook: PracticeNotebook): string => {
  const validated = parseNotebook(serializeNotebook(notebook));
  const header = '# OpsTriage practice notebook\n\nSynthetic learning scenarios. Diagnostic outputs are simulated; no commands were executed. Results reflect the latest submitted snapshot, not draft edits. Reasoning presence and length are checked, not semantic correctness. This notebook is not proof of production recovery or certification.\n';
  if (!validated.attempts.length) return `${header}\nNo practice attempts saved yet.\n`;
  return [header, ...validated.attempts.flatMap((attempt) => {
    const scenario = PRACTICE_SCENARIOS.find((item) => item.id === attempt.scenarioId);
    return scenario ? [exportAttempt(scenario, attempt)] : [];
  })].join('\n');
};
