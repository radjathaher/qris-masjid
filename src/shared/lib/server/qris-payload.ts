type TlvEntry = {
  tag: string;
  length: number;
  value: string;
  offset: number;
};

type ValidatedQrisPayload = {
  normalizedPayload: string;
  merchantName: string;
  merchantCity: string;
  pointOfInitiationMethod: string | null;
  nmid: string | null;
};

function isTwoDigitNumber(value: string): boolean {
  return /^\d{2}$/.test(value);
}

function parseTlv(input: string): TlvEntry[] {
  const entries: TlvEntry[] = [];
  let cursor = 0;

  while (cursor < input.length) {
    if (cursor + 4 > input.length) {
      throw new Error("Payload TLV tidak valid");
    }

    const tag = input.slice(cursor, cursor + 2);
    const lengthRaw = input.slice(cursor + 2, cursor + 4);

    if (!isTwoDigitNumber(lengthRaw)) {
      throw new Error("Panjang TLV tidak valid");
    }

    const length = Number(lengthRaw);
    const valueStart = cursor + 4;
    const valueEnd = valueStart + length;

    if (valueEnd > input.length) {
      throw new Error("Panjang TLV melebihi ukuran payload");
    }

    entries.push({
      tag,
      length,
      value: input.slice(valueStart, valueEnd),
      offset: cursor,
    });

    cursor = valueEnd;
  }

  return entries;
}

function crc16CcittFalse(input: string): string {
  let crc = 0xffff;

  for (let index = 0; index < input.length; index += 1) {
    crc ^= input.charCodeAt(index) << 8;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function findSingleEntry(entries: TlvEntry[], tag: string): TlvEntry | null {
  return entries.find((entry) => entry.tag === tag) ?? null;
}

function isMerchantAccountTag(tag: string): boolean {
  const number = Number(tag);
  return Number.isInteger(number) && number >= 26 && number <= 51;
}

function assertPayloadFormatIndicator(entries: TlvEntry[]) {
  const payloadFormat = findSingleEntry(entries, "00")?.value;
  if (payloadFormat !== "01") {
    throw new Error("Indikator format payload harus 01");
  }
}

function assertCountryAndCurrency(entries: TlvEntry[]) {
  const country = findSingleEntry(entries, "58")?.value;
  const currency = findSingleEntry(entries, "53")?.value;

  if (country !== "ID") {
    throw new Error("Kode negara QRIS harus ID");
  }

  if (currency !== "360") {
    throw new Error("Kode mata uang QRIS harus 360");
  }
}

function findQrisMerchantTemplate(entries: TlvEntry[]): { tag: string; nested: TlvEntry[] } | null {
  const merchantEntries = entries.filter((entry) => isMerchantAccountTag(entry.tag));

  if (merchantEntries.length === 0) {
    return null;
  }

  for (const entry of merchantEntries) {
    try {
      const nested = parseTlv(entry.value);
      const hasQrisGui = nested.some(
        (nestedEntry) => nestedEntry.tag === "00" && nestedEntry.value === "ID.CO.QRIS.WWW",
      );

      if (hasQrisGui) {
        return { tag: entry.tag, nested };
      }
    } catch {
      // Ignore malformed nested merchant templates and continue scanning.
    }
  }

  return null;
}

function assertMerchantAccount(entries: TlvEntry[]): { tag: string; nested: TlvEntry[] } {
  const merchantEntries = entries.filter((entry) => isMerchantAccountTag(entry.tag));

  if (merchantEntries.length === 0) {
    throw new Error("Informasi akun merchant tidak ditemukan");
  }

  const template = findQrisMerchantTemplate(entries);

  if (!template) {
    throw new Error("Akun merchant tidak dikenali sebagai QRIS");
  }

  return template;
}

function collectPotentialNmidValues(entries: TlvEntry[], templateNested: TlvEntry[]): string[] {
  const additionalDataEntry = findSingleEntry(entries, "62");
  const additionalNested: TlvEntry[] = [];

  if (additionalDataEntry) {
    try {
      additionalNested.push(...parseTlv(additionalDataEntry.value));
    } catch {
      // Ignore malformed additional data object; hard checks remain CRC/TLV-level.
    }
  }

  return [
    ...templateNested.map((entry) => entry.value),
    ...additionalNested.map((entry) => entry.value),
    ...entries.map((entry) => entry.value),
  ];
}

function findNmid(values: string[]): string | null {
  return values.find((value) => /^ID\d{10,20}$/.test(value)) ?? null;
}

function assertCrc(rawPayload: string, entries: TlvEntry[]) {
  const crcEntry = entries[entries.length - 1];

  if (!crcEntry || crcEntry.tag !== "63" || crcEntry.length !== 4) {
    throw new Error("Field CRC (tag 63) tidak ada atau tidak valid");
  }

  const payloadForChecksum = `${rawPayload.slice(0, crcEntry.offset + 4)}0000`;
  const expectedCrc = crc16CcittFalse(payloadForChecksum);

  if (crcEntry.value.toUpperCase() !== expectedCrc) {
    throw new Error("Validasi CRC QRIS gagal");
  }
}

export function validateQrisPayload(rawPayload: string): ValidatedQrisPayload {
  const normalizedPayload = rawPayload.trim();

  if (!normalizedPayload) {
    throw new Error("Payload QR kosong");
  }

  const entries = parseTlv(normalizedPayload);

  assertPayloadFormatIndicator(entries);
  assertCountryAndCurrency(entries);
  const merchantTemplate = assertMerchantAccount(entries);
  assertCrc(normalizedPayload, entries);

  const merchantName = findSingleEntry(entries, "59")?.value ?? "";
  const merchantCity = findSingleEntry(entries, "60")?.value ?? "";
  const pointOfInitiationMethod = findSingleEntry(entries, "01")?.value ?? null;
  const nmid = findNmid(collectPotentialNmidValues(entries, merchantTemplate.nested));

  if (!merchantName) {
    throw new Error("Nama merchant (tag 59) tidak ditemukan");
  }

  if (!merchantCity) {
    throw new Error("Kota merchant (tag 60) tidak ditemukan");
  }

  return {
    normalizedPayload,
    merchantName,
    merchantCity,
    pointOfInitiationMethod,
    nmid,
  };
}
