# Skill Measurement

The `/skills` page reads computed skill snapshots from GitHub Issues labeled `skill-snapshot`.
Each snapshot stores only derived scores, countable inputs, provider names, export dates, file counts, and PNG metadata. Raw conversation text is processed in memory and is not persisted.

## Supported uploads

- Claude data-export ZIP with `conversations.json`
- ChatGPT data-export ZIP with `conversations.json`
- Google or Gemini Takeout JSON or HTML
- PNG screenshots as metadata only. No OCR is performed in v1 and image binaries are not stored.

Unknown formats return a friendly unsupported-format message and do not crash.

## Counted signals

- Provider: export source detected from the file shape or filename
- Conversation date: best available creation or update date
- Message count: total normalized messages
- User prompt count: messages attributed to user or human roles
- User prompt length: total and average character count for user prompts
- Code block count: markdown code fences and inline code-like snippets
- Follow-up depth: largest count of user prompts after the first user prompt in one conversation
- Correction markers: prompts containing words like actually, instead, wrong, revert, or try again
- Dimension markers: keyword hits for debugging, architecture, testing, reviewing, and shipping themes

## Score formulas

All dimensions map countable inputs to a 0 to 100 value. Small samples are still scored, but the UI labels them as small data.

- Prompting: `round(35 * avgPromptLengthScore + 20 * followUpScore + 20 * codeContextScore + 25 * correctionScore)`
- Debugging: `round(50 * debugMarkerScore + 25 * correctionScore + 25 * codeContextScore)`
- Architecture: `round(60 * architectureMarkerScore + 25 * avgPromptLengthScore + 15 * followUpScore)`
- Testing: `round(70 * testingMarkerScore + 20 * codeContextScore + 10 * correctionScore)`
- Reviewing: `round(65 * reviewingMarkerScore + 20 * correctionScore + 15 * followUpScore)`
- Shipping: `round(65 * shippingMarkerScore + 20 * testingMarkerScore + 15 * followUpScore)`

## Radar data

The chart keeps the existing radar component. Its `Start` series comes from the earliest snapshot and its `Now` series comes from the latest snapshot. If no snapshot exists or GitHub is not connected, the route shows the existing placeholder numbers labeled `Sample data`.
