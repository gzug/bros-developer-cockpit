import { deflateRawSync } from "node:zlib";
import { expect, test } from "bun:test";
import {
  MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES,
  MAX_ZIP_UPLOAD_BYTES,
  parseSkillUploadBatch,
  readZipEntries,
} from "./skill-export-parser.server";

function oneEntryZip(declaredSize = 1): Buffer {
  const name = Buffer.from("conversations.json");
  const raw = Buffer.from("{}");
  const compressed = deflateRawSync(raw);
  const local = Buffer.alloc(30 + name.length);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(raw.length, 22);
  local.writeUInt16LE(name.length, 26);
  name.copy(local, 30);

  const central = Buffer.alloc(46 + name.length);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(declaredSize, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(0, 42);
  name.copy(central, 46);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(local.length + compressed.length, 16);
  return Buffer.concat([local, compressed, central, end]);
}

test("oversized uploads fail before ZIP parsing", async () => {
  const result = await parseSkillUploadBatch([new File([Buffer.alloc(MAX_ZIP_UPLOAD_BYTES + 1)], "large.zip", { type: "application/zip" })]);
  expect(result.ok).toBe(false);
  expect(result.warnings.join(" ")).toContain("30 MB");
});

test("declared decompressed entry size is capped before inflate", () => {
  expect(() => readZipEntries(oneEntryZip(MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES + 1))).toThrow("20 MB");
});
