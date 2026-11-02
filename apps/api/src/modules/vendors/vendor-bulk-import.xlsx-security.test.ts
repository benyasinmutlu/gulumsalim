import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { validateXlsxArchive } from "./vendor-bulk-import.service";

async function validWorkbookBuffer() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Ürünler");
  sheet.addRow(["Ürün Adı", "Fiyat", "Stok"]);
  sheet.addRow(["Test Elbise", 499.9, 3]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function firstCentralDirectoryOffset(buffer: Buffer) {
  for (let offset = 0; offset <= buffer.length - 4; offset++) {
    if (buffer.readUInt32LE(offset) === 0x02014b50) return offset;
  }
  throw new Error("test fixture central directory missing");
}

describe("XLSX archive hardening", () => {
  it("accepts a normal Excel workbook", async () => {
    const buffer = await validWorkbookBuffer();
    expect(() => validateXlsxArchive(buffer)).not.toThrow();
  });

  it("rejects an entry that advertises a zip-bomb-sized output", async () => {
    const buffer = await validWorkbookBuffer();
    const centralOffset = firstCentralDirectoryOffset(buffer);
    buffer.writeUInt32LE(48 * 1024 * 1024, centralOffset + 24);
    expect(() => validateXlsxArchive(buffer)).toThrow(/boyutu/);
  });

  it("rejects path traversal in archive entry names", async () => {
    const buffer = await validWorkbookBuffer();
    const centralOffset = firstCentralDirectoryOffset(buffer);
    const nameLength = buffer.readUInt16LE(centralOffset + 28);
    const maliciousName = Buffer.from(`../${"x".repeat(Math.max(0, nameLength - 3))}`).subarray(0, nameLength);
    maliciousName.copy(buffer, centralOffset + 46);
    expect(() => validateXlsxArchive(buffer)).toThrow(/güvensiz dosya yolu/);
  });
});
