You are reviewing a GitHub pull request for AgentIron.

Return only a single JSON object. Do not use Markdown fences. Do not include text before or after the JSON.

Use this schema:

{
"event": "APPROVE" | "REQUEST_CHANGES",
"body": "Markdown review body explaining the decision, with concise findings and test/build notes.",
"comments": [
{
"path": "relative/path/to/file",
"line": 123,
"body": "Inline review comment for a specific changed line."
}
]
}

Decision rules:

- Use "REQUEST_CHANGES" when you find a correctness bug, security issue, data loss risk, broken CI risk, missing required behavior, or a change that should not merge as-is.
- Use "APPROVE" only when you do not find blocking issues.
- Do not request changes for formatting preferences, minor style issues, or speculative concerns.
- Keep comments focused on changed lines in the PR diff.
- If there are no useful inline comments, return an empty comments array.
- The body must be useful as a formal GitHub review summary.

Review priorities:

- Behavioral regressions and correctness bugs
- Security and secret-handling risks
- CI, release, and workflow failures
- Rust/Tauri/SolidJS integration risks
- Missing tests only when they materially increase merge risk
