import { inflateRawSync } from "node:zlib";
import {
  computeSkillSnapshot,
  type ExportProvenance,
  type PngEvidence,
  type ProviderName,
  type SkillConversation,
  type SkillMessage,
  type SkillSnapshot,
} from "./skills-scoring";

export const SUPPORTED_SKILL_EXPORT_FORMATS =
  "Claude data-export ZIP with conversations.json, ChatGPT data-export ZIP with conversations.json, Google/Gemini Takeout JSON or HTML, and PNG metadata";

export const MAX_ZIP_UPLOAD_BYTES = 30 * 1024 * 1024;
export const MAX_ZIP_ENTRY_COUNT = 2_000;
export const MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES = 20 * 1024 * 1024;
export const MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;

export type ParsedSkillUploadBatch =
  | {
      ok: true;
      snapshot?: SkillSnapshot;
      pngEvidence: PngEvidence[];
      warnings: string[];
      message: string;
    }
  | {
      ok: false;
      message: string;
      warnings: string[];
    };

type ZipEntry = {
  name: string;
  data: Buffer;
};

type ParsedFile = {
  conversations: SkillConversation[];
  provenance: ExportProvenance;
};

function normalizeDate(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    const millis = value > 10_000_000_000 ? value : value * 1000;
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString();
  }
  return undefined;
}

function textFromContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(textFromContent).filter(Boolean).join("\n");
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  if (record.text != null) return textFromContent(record.text);
  if (record.content != null) return textFromContent(record.content);
  if (record.parts != null) return textFromContent(record.parts);
  if (record.message != null) return textFromContent(record.message);
  return "";
}

function normalizeRole(value: unknown): SkillMessage["role"] {
  const role = String(value ?? "").toLowerCase();
  if (role === "user" || role === "human") return "user";
  if (role === "assistant" || role === "model" || role === "gemini") return "assistant";
  if (role === "system") return "system";
  return "other";
}

function detectProvider(fileName: string, value: unknown): ProviderName {
  const lowerName = fileName.toLowerCase();
  if (lowerName.includes("claude")) return "Claude";
  if (lowerName.includes("chatgpt") || lowerName.includes("openai")) return "ChatGPT";
  if (lowerName.includes("google") || lowerName.includes("gemini") || lowerName.includes("takeout")) return "Google/Gemini";
  if (Array.isArray(value)) {
    const first = value[0] as Record<string, unknown> | undefined;
    if (first?.mapping) return "ChatGPT";
    if (first?.chat_messages || first?.messages) return "Claude";
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (record.mapping) return "ChatGPT";
    if (record.chat_messages || record.conversations) return "Claude";
  }
  return "Unknown";
}

function makeConversation(input: {
  provider: ProviderName;
  sourceFile: string;
  id?: unknown;
  title?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  messages: SkillMessage[];
}): SkillConversation | null {
  const messages = input.messages.filter((message) => message.text.trim());
  if (messages.length === 0) return null;
  const id = typeof input.id === "string" && input.id ? input.id : `${input.sourceFile}:${messages.length}:${input.title ?? ""}`;
  return {
    provider: input.provider,
    sourceFile: input.sourceFile,
    id,
    title: typeof input.title === "string" ? input.title : undefined,
    createdAt: normalizeDate(input.createdAt),
    updatedAt: normalizeDate(input.updatedAt),
    messages,
  };
}

function parseClaudeLikeConversation(provider: ProviderName, sourceFile: string, value: Record<string, unknown>): SkillConversation | null {
  const rawMessages = value.chat_messages ?? value.messages ?? value.entries;
  if (!Array.isArray(rawMessages)) return null;
  const messages = rawMessages.map((item) => {
    const record = item as Record<string, unknown>;
    return {
      role: normalizeRole(record.sender ?? record.role ?? record.author),
      text: textFromContent(record.text ?? record.content),
      createdAt: normalizeDate(record.created_at ?? record.createdAt ?? record.timestamp),
    };
  });
  return makeConversation({
    provider,
    sourceFile,
    id: value.uuid ?? value.id,
    title: value.name ?? value.title,
    createdAt: value.created_at ?? value.createdAt,
    updatedAt: value.updated_at ?? value.updatedAt,
    messages,
  });
}

function parseChatGptConversation(sourceFile: string, value: Record<string, unknown>): SkillConversation | null {
  const mapping = value.mapping;
  if (!mapping || typeof mapping !== "object") return null;
  const nodes = Object.values(mapping as Record<string, unknown>);
  const messages: SkillMessage[] = [];
  for (const node of nodes) {
    const message = (node as Record<string, unknown>).message as Record<string, unknown> | null | undefined;
    if (!message) continue;
    const author = message.author as Record<string, unknown> | undefined;
    const content = message.content as Record<string, unknown> | undefined;
    messages.push({
      role: normalizeRole(author?.role),
      text: textFromContent(content?.parts ?? content ?? message.content),
      createdAt: normalizeDate(message.create_time ?? message.update_time),
    });
  }
  return makeConversation({
    provider: "ChatGPT",
    sourceFile,
    id: value.id,
    title: value.title,
    createdAt: value.create_time,
    updatedAt: value.update_time,
    messages,
  });
}

function parseGenericConversation(provider: ProviderName, sourceFile: string, value: Record<string, unknown>): SkillConversation | null {
  if (value.mapping) return parseChatGptConversation(sourceFile, value);
  return parseClaudeLikeConversation(provider, sourceFile, value);
}

function parseJsonExport(text: string, sourceFile: string): ParsedFile {
  const parsed = JSON.parse(text) as unknown;
  const provider = detectProvider(sourceFile, parsed);
  const candidates = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as Record<string, unknown>)?.conversations)
      ? ((parsed as Record<string, unknown>).conversations as unknown[])
      : [parsed];

  const conversations = candidates
    .map((entry) => (entry && typeof entry === "object" ? parseGenericConversation(provider, sourceFile, entry as Record<string, unknown>) : null))
    .filter((conversation): conversation is SkillConversation => Boolean(conversation));

  if (conversations.length === 0) {
    throw new Error("No conversations found in JSON export.");
  }

  const messageCount = conversations.reduce((sum, conversation) => sum + conversation.messages.length, 0);
  const userPromptCount = conversations.reduce(
    (sum, conversation) => sum + conversation.messages.filter((message) => message.role === "user").length,
    0,
  );
  const dates = conversations
    .flatMap((conversation) => [conversation.updatedAt, conversation.createdAt])
    .filter((date): date is string => Boolean(date))
    .sort();

  return {
    conversations,
    provenance: {
      provider,
      filename: sourceFile,
      exportDate: dates.at(-1),
      conversationCount: conversations.length,
      messageCount,
      userPromptCount,
    },
  };
}

function decodeHtml(text: string): string {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function parseHtmlExport(text: string, sourceFile: string): ParsedFile {
  const decoded = decodeHtml(text);
  const chunks = decoded.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const messages: SkillMessage[] = [];
  for (const chunk of chunks) {
    const match = chunk.match(/^(user|you|human|assistant|gemini|model)\s*:\s*(.+)$/i);
    if (match) {
      messages.push({ role: normalizeRole(match[1]), text: match[2] });
    }
  }
  if (messages.length === 0 && decoded.length > 0) {
    messages.push({ role: "other", text: decoded });
  }
  const conversation = makeConversation({
    provider: "Google/Gemini",
    sourceFile,
    id: sourceFile,
    title: sourceFile,
    messages,
  });
  if (!conversation) throw new Error("No conversations found in HTML export.");
  return {
    conversations: [conversation],
    provenance: {
      provider: "Google/Gemini",
      filename: sourceFile,
      conversationCount: 1,
      messageCount: conversation.messages.length,
      userPromptCount: conversation.messages.filter((message) => message.role === "user").length,
    },
  };
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const signature = 0x06054b50;
  const minOffset = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= minOffset; offset--) {
    if (buffer.readUInt32LE(offset) === signature) return offset;
  }
  throw new Error("ZIP central directory not found.");
}

export function readZipEntries(buffer: Buffer): ZipEntry[] {
  if (buffer.length > MAX_ZIP_UPLOAD_BYTES) {
    throw new Error("ZIP upload is too large. Maximum size is 30 MB.");
  }
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  if (entryCount > MAX_ZIP_ENTRY_COUNT) {
    throw new Error("ZIP contains too many entries. Maximum is 2000.");
  }
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  if (centralDirectoryOffset + centralDirectorySize > buffer.length) {
    throw new Error("Invalid ZIP central directory.");
  }
  const entries: ZipEntry[] = [];
  let offset = centralDirectoryOffset;
  let totalUncompressedBytes = 0;

  for (let i = 0; i < entryCount; i++) {
    if (offset + 46 > buffer.length) throw new Error("Invalid ZIP central directory.");
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error("Invalid ZIP central directory.");
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const declaredUncompressedSize = buffer.readUInt32LE(offset + 24);
    if (declaredUncompressedSize > MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES) {
      throw new Error("ZIP entry exceeds the 20 MB decompressed limit.");
    }
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8");

    if (localHeaderOffset + 30 > buffer.length || buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
      throw new Error("Invalid ZIP local header.");
    }
    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
    if (dataOffset + compressedSize > buffer.length) throw new Error("Invalid ZIP entry bounds.");
    const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);
    let data: Buffer | undefined;
    try {
      data = method === 0
        ? compressed
        : method === 8
          ? inflateRawSync(compressed, { maxOutputLength: MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES })
          : undefined;
    } catch {
      throw new Error("ZIP entry exceeds the 20 MB decompressed limit or is invalid.");
    }
    if (data) {
      if (data.length > MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES) {
        throw new Error("ZIP entry exceeds the 20 MB decompressed limit.");
      }
      totalUncompressedBytes += data.length;
      if (totalUncompressedBytes > MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES) {
        throw new Error("ZIP decompressed data exceeds the 50 MB total limit.");
      }
      if (!name.endsWith("/")) entries.push({ name, data });
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function parseZipExport(buffer: Buffer, fileName: string): ParsedFile[] {
  const entries = readZipEntries(buffer);
  const preferred = entries.filter((entry) => entry.name.toLowerCase().endsWith("conversations.json"));
  const fallback = entries.filter((entry) => /\.(json|html?)$/i.test(entry.name));
  const candidates = preferred.length > 0 ? preferred : fallback;
  const parsed: ParsedFile[] = [];
  const errors: string[] = [];

  for (const entry of candidates) {
    const sourceName = `${fileName}/${entry.name}`;
    const text = entry.data.toString("utf8");
    try {
      if (/\.html?$/i.test(entry.name)) parsed.push(parseHtmlExport(text, sourceName));
      else parsed.push(parseJsonExport(text, sourceName));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (parsed.length === 0) {
    throw new Error(errors[0] ?? "No supported export file found inside ZIP.");
  }
  return parsed;
}

async function parseFile(file: File): Promise<ParsedFile[]> {
  if (file.size > MAX_ZIP_UPLOAD_BYTES) {
    throw new Error("Upload is too large. Maximum size is 30 MB.");
  }
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".zip") || file.type.includes("zip")) {
    return parseZipExport(Buffer.from(await file.arrayBuffer()), file.name);
  }
  const text = await file.text();
  if (lowerName.endsWith(".json") || file.type.includes("json")) return [parseJsonExport(text, file.name)];
  if (lowerName.endsWith(".html") || lowerName.endsWith(".htm") || file.type.includes("html")) return [parseHtmlExport(text, file.name)];
  throw new Error("Unsupported file type.");
}

function pngEvidenceFromFile(file: File, note?: string): PngEvidence {
  return {
    filename: file.name,
    sizeBytes: file.size,
    lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : undefined,
    note: note?.trim() || undefined,
  };
}

export async function parseSkillUploadBatch(files: File[], note?: string): Promise<ParsedSkillUploadBatch> {
  const conversations: SkillConversation[] = [];
  const exports: ExportProvenance[] = [];
  const pngEvidence: PngEvidence[] = [];
  const warnings: string[] = [];

  for (const file of files) {
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith(".png") || file.type === "image/png") {
      pngEvidence.push(pngEvidenceFromFile(file, note));
      continue;
    }

    try {
      const parsed = await parseFile(file);
      for (const entry of parsed) {
        conversations.push(...entry.conversations);
        exports.push(entry.provenance);
      }
    } catch (error) {
      warnings.push(`${file.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (conversations.length === 0 && pngEvidence.length === 0) {
    return {
      ok: false,
      message: `Unsupported format. Supported formats: ${SUPPORTED_SKILL_EXPORT_FORMATS}.`,
      warnings,
    };
  }

  if (conversations.length === 0) {
    return {
      ok: true,
      pngEvidence,
      warnings,
      message: "PNG metadata accepted. No skill score changed because screenshots are not parsed in v1.",
    };
  }

  const snapshot = computeSkillSnapshot({
    conversations,
    exports,
    pngEvidence,
  });

  return {
    ok: true,
    snapshot,
    pngEvidence,
    warnings,
    message: `Processed ${conversations.length} conversation${conversations.length === 1 ? "" : "s"} from ${exports.length} export${exports.length === 1 ? "" : "s"}.`,
  };
}
