import fs from "node:fs";

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const pullNumber = Number(process.env.PR_NUMBER);
const commitId = process.env.PR_HEAD_SHA;
const outputPath = process.env.OPENCODE_OUTPUT_PATH ?? ".opencode-formal/opencode.jsonl";

if (!token || !repository || !pullNumber || !commitId) {
  throw new Error("Missing required review submission environment variables");
}

function collectTextEvents(path) {
  const lines = fs.readFileSync(path, "utf8").split(/\r?\n/);
  const text = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const event = JSON.parse(line);
      if (event.type === "text" && typeof event.part?.text === "string") {
        text.push(event.part.text);
      }
    } catch {
      text.push(line);
    }
  }

  return text.join("\n").trim();
}

function extractJsonObject(text) {
  const withoutFence = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(withoutFence);
  } catch {
    const start = withoutFence.indexOf("{");
    const end = withoutFence.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("OpenCode did not return a JSON object");
    }

    return JSON.parse(withoutFence.slice(start, end + 1));
  }
}

function normalizeReview(raw) {
  const event =
    raw.event === "REQUEST_CHANGES"
      ? "REQUEST_CHANGES"
      : raw.event === "APPROVE"
        ? "APPROVE"
        : null;
  if (!event) {
    throw new Error(`Invalid review event: ${raw.event}`);
  }

  const body =
    typeof raw.body === "string" && raw.body.trim()
      ? raw.body.trim()
      : "OpenCode completed the review without a body.";

  const comments = Array.isArray(raw.comments)
    ? raw.comments
        .filter(
          (comment) =>
            typeof comment.path === "string" &&
            Number.isInteger(comment.line) &&
            comment.line > 0 &&
            typeof comment.body === "string" &&
            comment.body.trim(),
        )
        .map((comment) => ({
          path: comment.path,
          line: comment.line,
          side: comment.side === "LEFT" ? "LEFT" : "RIGHT",
          body: comment.body.trim(),
        }))
    : [];

  return { event, body, comments };
}

async function createReview(review) {
  const response = await fetch(
    `https://api.github.com/repos/${repository}/pulls/${pullNumber}/reviews`,
    {
      method: "POST",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-github-api-version": "2022-11-28",
      },
      body: JSON.stringify({
        commit_id: commitId,
        event: review.event,
        body: review.body,
        comments: review.comments,
      }),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GitHub review API failed with ${response.status}: ${errorBody}`);
  }
}

const rawText = collectTextEvents(outputPath);
let review;

try {
  review = normalizeReview(extractJsonObject(rawText));
} catch (error) {
  review = {
    event: "REQUEST_CHANGES",
    body: `OpenCode formal review failed because the model output could not be parsed.\n\nError: ${error.message}`,
    comments: [],
  };
}

try {
  await createReview(review);
} catch (error) {
  if (review.comments.length === 0) throw error;

  await createReview({
    ...review,
    body: `${review.body}\n\nNote: inline comments could not be submitted against the current diff, so this review was submitted as a body-only review.`,
    comments: [],
  });
}

console.log(`Submitted ${review.event} review with ${review.comments.length} inline comment(s).`);
