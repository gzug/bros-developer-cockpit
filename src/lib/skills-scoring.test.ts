import { deflateRawSync } from "node:zlib";
import { expect, test } from "bun:test";
import { parseSkillUploadBatch } from "./skill-export-parser.server";
import { chartDataFromSnapshots, snapshotHasRawText } from "./skills-scoring";

function dosDateTime() {
  return { time: 0, date: 0 };
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeZip(entries: Array<{ name: string; text: string }>): Uint8Array {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const raw = Buffer.from(entry.text);
    const compressed = deflateRawSync(raw);
    const crc = crc32(raw);
    const { time, date } = dosDateTime();

    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);
    localParts.push(local, compressed);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centralParts.push(central);

    offset += local.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function assertScores(snapshot: NonNullable<Awaited<ReturnType<typeof parseSkillUploadBatch>>["snapshot"]>) {
  for (const value of Object.values(snapshot.scores)) {
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(100);
  }
  expect(Object.keys(snapshot.scores).sort()).toEqual([
    "Architecture",
    "Debugging",
    "Prompting",
    "Reviewing",
    "Shipping",
    "Testing",
  ]);
}

test("synthetic Claude ZIP yields skill snapshot values and provenance", async () => {
  const conversations = [
    {
      uuid: "claude-1",
      name: "Synthetic Claude session",
      created_at: "2026-07-01T10:00:00Z",
      chat_messages: [
        {
          sender: "human",
          text: "Please debug this failing test and explain the architecture boundary. ```ts\nexpect(value).toBe(true)\n```",
        },
        { sender: "assistant", text: "I will inspect the failure." },
        { sender: "human", text: "Actually, instead add a regression test before shipping the PR." },
      ],
    },
  ];
  const zip = makeZip([{ name: "conversations.json", text: JSON.stringify(conversations) }]);
  const file = new File([zip], "claude-data-export.zip", { type: "application/zip" });
  const result = await parseSkillUploadBatch([file]);

  expect(result.ok).toBe(true);
  expect(result.snapshot).toBeDefined();
  assertScores(result.snapshot!);
  expect(result.snapshot!.provenance.exports[0].provider).toBe("Claude");
  expect(result.snapshot!.provenance.conversationCount).toBe(1);
  expect(snapshotHasRawText(result.snapshot!, ["Please debug this failing test", "regression test before shipping"])).toBe(false);
});

test("synthetic ChatGPT ZIP yields skill snapshot values and provenance", async () => {
  const conversations = [
    {
      id: "chatgpt-1",
      title: "Synthetic ChatGPT session",
      create_time: 1782928800,
      mapping: {
        a: {
          message: {
            author: { role: "user" },
            content: {
              parts: [
                "Review this PR diff, find the broken release path, and write tests before merge.",
              ],
            },
            create_time: 1782928800,
          },
        },
        b: {
          message: {
            author: { role: "assistant" },
            content: { parts: ["Here is the review."] },
            create_time: 1782928860,
          },
        },
        c: {
          message: {
            author: { role: "user" },
            content: { parts: ["Wrong assumption. Use the module interface and ship after build validation."] },
            create_time: 1782928920,
          },
        },
      },
    },
  ];
  const zip = makeZip([{ name: "conversations.json", text: JSON.stringify(conversations) }]);
  const file = new File([zip], "chatgpt-export.zip", { type: "application/zip" });
  const result = await parseSkillUploadBatch([file]);

  expect(result.ok).toBe(true);
  expect(result.snapshot).toBeDefined();
  assertScores(result.snapshot!);
  expect(result.snapshot!.provenance.exports[0].provider).toBe("ChatGPT");
  expect(result.snapshot!.provenance.userPromptCount).toBe(2);
  expect(snapshotHasRawText(result.snapshot!, ["Review this PR diff", "Wrong assumption"])).toBe(false);
});

test("unsupported file returns friendly supported-format message", async () => {
  const file = new File(["not an export"], "notes.txt", { type: "text/plain" });
  const result = await parseSkillUploadBatch([file]);

  expect(result.ok).toBe(false);
  expect(result.message).toContain("Unsupported format.");
  expect(result.message).toContain("Claude data-export ZIP");
  expect(result.message).toContain("ChatGPT data-export ZIP");
  expect(result.message).toContain("Google/Gemini Takeout");
  expect(result.message).toContain("PNG metadata");
});

test("radar rows read earliest snapshot as Start and latest snapshot as Now", async () => {
  const first = (await parseSkillUploadBatch([
    new File([
      makeZip([
        {
          name: "conversations.json",
          text: JSON.stringify([
            {
              mapping: {
                a: { message: { author: { role: "user" }, content: { parts: ["debug bug"] } } },
              },
            },
          ]),
        },
      ]),
    ], "chatgpt-one.zip", { type: "application/zip" }),
  ])).snapshot!;
  const second = (await parseSkillUploadBatch([
    new File([
      makeZip([
        {
          name: "conversations.json",
          text: JSON.stringify([
            {
              mapping: {
                a: { message: { author: { role: "user" }, content: { parts: ["test review ship architecture"] } } },
              },
            },
          ]),
        },
      ]),
    ], "chatgpt-two.zip", { type: "application/zip" }),
  ])).snapshot!;
  first.createdAt = "2026-07-01T00:00:00.000Z";
  second.createdAt = "2026-07-02T00:00:00.000Z";

  const rows = chartDataFromSnapshots([second, first]);

  expect(rows.find((row) => row.skill === "Debugging")?.start).toBe(first.scores.Debugging);
  expect(rows.find((row) => row.skill === "Debugging")?.now).toBe(second.scores.Debugging);
  expect(chartDataFromSnapshots([])[0]).toEqual({ skill: "Prompting", start: 50, now: 82 });
});
