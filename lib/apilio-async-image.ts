type JsonObject = Record<string, unknown>;

export function apilioGenerationHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Prefer: "respond-async",
  };
}

export function apilioTaskUrl(
  baseURL: string,
  headers: Record<string, string>,
  data: JsonObject,
) {
  const advertised =
    headers.location ||
    stringValue(data.status_url) ||
    stringValue(data.poll_url);
  if (advertised) {
    try {
      const url = new URL(advertised, baseURL);
      if (url.origin === new URL(baseURL).origin && !url.username && !url.password)
        return url.toString();
    } catch {
      // Use the task ID if the response also supplied one.
    }
  }
  const taskId = stringValue(data.task_id) || stringValue(objectValue(data.data)?.task_id) || stringValue(data.id);
  return taskId
    ? new URL(`/v1/images/tasks/${encodeURIComponent(taskId)}`, baseURL).toString()
    : undefined;
}

export function apilioTaskOutcome(data: JsonObject):
  | { state: "pending" }
  | { state: "completed"; entries: unknown[] }
  | { state: "failed"; error: string } {
  const wrappedTask = objectValue(data.data);
  const task = wrappedTask && stringValue(wrappedTask.status) ? wrappedTask : data;
  const status = stringValue(task.status)?.toLowerCase();
  const entries = imageEntries(task);
  if (entries.length && (!status || ["completed", "complete", "success", "succeeded"].includes(status)))
    return { state: "completed", entries };
  if (["failed", "failure", "error", "cancelled", "canceled"].includes(status || ""))
    return { state: "failed", error: stringValue(task.fail_reason) || errorMessage(task) || "Apilio 图片任务失败。" };
  return { state: "pending" };
}

function imageEntries(data: JsonObject) {
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.images)) return data.images;
  const payload = objectValue(data.data);
  if (Array.isArray(payload?.data)) return payload.data;
  const result = objectValue(data.result);
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.images)) return result.images;
  const markdown = stringValue(data.result_content) || stringValue(result?.result_content);
  return markdown
    ? Array.from(markdown.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g), (match) => ({ url: match[1] }))
    : [];
}

function errorMessage(data: JsonObject) {
  const error = data.error;
  if (typeof error === "string") return error;
  return stringValue(objectValue(error)?.message) || stringValue(data.message);
}

function objectValue(value: unknown): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
