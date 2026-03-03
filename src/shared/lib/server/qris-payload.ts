type TlvEntry = {
  tag: string;
  length: number;
  value: string;
  offset: number;
};

function isTwoDigitNumber(value: string): boolean {
  return /^\d{2}$/.test(value);
}

function parseTlv(input: string): TlvEntry[] {
  const entries: TlvEntry[] = [];
  let cursor = 0;

  while (cursor < input.length) {
    if (cursor + 4 > input.length) {
      throw new Error("Malformed TLV payload");
    }

    const tag = input.slice(cursor, cursor + 2);
    const lengthRaw = input.slice(cursor + 2, cursor + 4);

    if (!isTwoDigitNumber(lengthRaw)) {
      throw new Error("Invalid TLV length field");
    }

    const length = Number(lengthRaw);
    const valueStart = cursor + 4;
    const valueEnd = valueStart + length;

    if (valueEnd > input.length) {
      throw new Error("TLV length exceeds payload size");
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
    throw new Error("Payload format indicator must be 01");
  }
}

function assertCountryAndCurrency(entries: TlvEntry[]) {
  const country = findSingleEntry(entries, "58")?.value;
  const currency = findSingleEntry(entries, "53")?.value;

  if (country !== "ID") {
    throw new Error("QRIS country code must be ID");
  }

  if (currency !== "360") {
    throw new Error("QRIS currency code must be 360");
  }
}

function assertMerchantAccount(entries: TlvEntry[]) {
  const merchantEntries = entries.filter((entry) => isMerchantAccountTag(entry.tag));

  if (merchantEntries.length === 0) {
    throw new Error("Missing merchant account information");
  }

  const hasQrisGui = merchantEntries.some((entry) => {
    try {
      const nested = parseTlv(entry.value);
      return nested.some(
        (nestedEntry) => nestedEntry.tag === "00" && nestedEntry.value === "ID.CO.QRIS.WWW",
      );
    } catch {
      return false;
    }
  });

  if (!hasQrisGui) {
    throw new Error("Merchant account is not recognized as QRIS");
  }
}

function assertCrc(rawPayload: string, entries: TlvEntry[]) {
  const crcEntry = entries[entries.length - 1];

  if (!crcEntry || crcEntry.tag !== "63" || crcEntry.length !== 4) {
    throw new Error("CRC field (tag 63) is missing or invalid");
  }

  const payloadForChecksum = `${rawPayload.slice(0, crcEntry.offset + 4)}0000`;
  const expectedCrc = crc16CcittFalse(payloadForChecksum);

  if (crcEntry.value.toUpperCase() !== expectedCrc) {
    throw new Error("QRIS CRC validation failed");
  }
}

export function validateQrisPayload(rawPayload: string): { normalizedPayload: string } {
  const normalizedPayload = rawPayload.trim();

  if (!normalizedPayload) {
    throw new Error("QR payload is empty");
  }

  const entries = parseTlv(normalizedPayload);

  assertPayloadFormatIndicator(entries);
  assertCountryAndCurrency(entries);
  assertMerchantAccount(entries);
  assertCrc(normalizedPayload, entries);

  return { normalizedPayload };
}
