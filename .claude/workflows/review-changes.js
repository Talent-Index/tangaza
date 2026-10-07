export const meta = {
  name: 'review-changes',
  description: 'Review the current branch diff across several dimensions, then adversarially verify each finding',
  whenToUse: 'Before committing or deploying: review uncommitted/branch changes in web/ and contracts/',
  phases: [
    { title: 'Review', detail: 'one reviewer per dimension reads the diff' },
    { title: 'Verify', detail: 'skeptics try to refute each finding' },
  ],
}

// args (optional): { base: 'main' } — ref to diff against. Defaults to main plus uncommitted changes.
const base = (args && args.base) || 'main'
const SCOPE = `Scope: the changes in this repo relative to \`${base}\` (run \`git diff ${base}...HEAD\` and \`git diff HEAD\` to see committed and uncommitted work; also check \`git status\` for untracked files). The app lives in web/ (Next.js 16, React 19, Tailwind 4, thirdweb/viem, x402, Neon) and Solidity in contracts/.`

const DIMENSIONS = [
  {
    key: 'correctness',
    prompt: `${SCOPE}\nFind real correctness bugs: logic errors, broken types, unhandled null/undefined, bad async/await, wrong Next.js server/client boundaries, broken imports. Ignore style.`,
  },
  {
    key: 'security',
    prompt: `${SCOPE}\nFind security problems: secrets in code, missing auth/validation on API routes, unsafe SQL, unvalidated input (zod), wallet/signature and payment (x402) flow flaws, contract access-control or reentrancy issues.\nAlso check for the known recurring malware: any obfuscated payload in web/postcss.config.mjs, any .vscode/tasks.json with runOn folderOpen or hidden commands, and any unexplained eval/Function/base64/child_process usage in config files. Report these as critical.`,
  },
  {
    key: 'ui',
    prompt: `${SCOPE}\nReview UI changes for regressions: broken dark/light theme parity, responsive layout problems, missing accessibility (labels, focus, alt text, contrast), dead links, and mismatches between pages sharing a shell.`,
  },
  {
    key: 'build',
    prompt: `${SCOPE}\nRun \`npm run typecheck\` and \`npm run lint\` in web/ and report any failures that relate to the changed files. Also flag env vars used but not documented, and ABI drift between contracts/ and web/ (see \`sync:abi\`). Do not run the dev server or deploy.`,
  },
]

const FINDINGS = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          line: { type: 'integer' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          summary: { type: 'string' },
          failure_scenario: { type: 'string' },
        },
        required: ['file', 'summary', 'failure_scenario', 'severity'],
      },
    },
  },
  required: ['findings'],
}

const VERDICT = {
  type: 'object',
  properties: {
    refuted: { type: 'boolean' },
    reason: { type: 'string' },
  },
  required: ['refuted', 'reason'],
}

const results = await pipeline(
  DIMENSIONS,
  d => agent(d.prompt + '\nReturn only findings you can point to in code; return an empty list if there are none.', {
    label: `review:${d.key}`,
    phase: 'Review',
    schema: FINDINGS,
  }),
  (review, d) => parallel((review ? review.findings : []).map(f => async () => {
    const claim = `${f.file}${f.line ? ':' + f.line : ''} — ${f.summary}\nScenario: ${f.failure_scenario}`
    const votes = await parallel([0, 1].map(i => () =>
      agent(`Read the actual code and try to REFUTE this ${d.key} finding. Default to refuted=true if you cannot confirm it from the code.\n\n${claim}`, {
        label: `verify:${d.key}:${f.file}#${i}`,
        phase: 'Verify',
        schema: VERDICT,
      })))
    const live = votes.filter(Boolean)
    // a finding survives only if no skeptic managed to refute it
    const survives = live.length > 0 && live.every(v => !v.refuted)
    return { dimension: d.key, ...f, survives, verdicts: live }
  })),
)

const all = results.filter(Boolean).flat().filter(Boolean)
const confirmed = all.filter(f => f.survives)
log(`${all.length} candidate findings, ${confirmed.length} survived verification`)

const order = { critical: 0, high: 1, medium: 2, low: 3 }
confirmed.sort((a, b) => order[a.severity] - order[b.severity])
return { confirmed, rejected: all.filter(f => !f.survives).map(f => ({ file: f.file, summary: f.summary })) }
