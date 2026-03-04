import { decode as decodePng } from "fast-png";
import type { PngDataArray } from "fast-png";
import jpeg from "jpeg-js";
import jsQR from "jsqr";
import type { DecodedBase64Image } from "#/shared/lib/server/image";

function normalizePngData(data: PngDataArray): Uint8Array {
  if (data instanceof Uint16Array) {
    const output = new Uint8Array(data.length);

    for (let index = 0; index < data.length; index += 1) {
      output[index] = data[index] >> 8;
    }

    return output;
  }

  return data instanceof Uint8ClampedArray ? Uint8Array.from(data) : data;
}

function readRgb(source: Uint8Array, index: number): [number, number, number, number] {
  return [source[index], source[index + 1], source[index + 2], 255];
}

function readGrayAlpha(source: Uint8Array, index: number): [number, number, number, number] {
  const gray = source[index];
  return [gray, gray, gray, source[index + 1]];
}

function readGray(source: Uint8Array, index: number): [number, number, number, number] {
  const gray = source[index];
  return [gray, gray, gray, 255];
}

function readChannels(
  source: Uint8Array,
  index: number,
  channels: number,
): [number, number, number, number] {
  if (channels === 3) {
    return readRgb(source, index);
  }

  if (channels === 2) {
    return readGrayAlpha(source, index);
  }

  return readGray(source, index);
}

function toRgbaFromPngChannels(source: Uint8Array, channels: number): Uint8ClampedArray {
  if (channels === 4) {
    return new Uint8ClampedArray(source);
  }

  const pixelCount = Math.floor(source.length / channels);
  const rgba = new Uint8ClampedArray(pixelCount * 4);

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const sourceIndex = pixel * channels;
    const targetIndex = pixel * 4;
    const [red, green, blue, alpha] = readChannels(source, sourceIndex, channels);

    rgba[targetIndex] = red;
    rgba[targetIndex + 1] = green;
    rgba[targetIndex + 2] = blue;
    rgba[targetIndex + 3] = alpha;
  }

  return rgba;
}

function decodePngToRgba(image: DecodedBase64Image): {
  data: Uint8ClampedArray;
  width: number;
  height: number;
} {
  const png = decodePng(image.bytes);
  const source = normalizePngData(png.data);

  return {
    data: toRgbaFromPngChannels(source, png.channels),
    width: png.width,
    height: png.height,
  };
}

function decodeJpegToRgba(image: DecodedBase64Image): {
  data: Uint8ClampedArray;
  width: number;
  height: number;
} {
  const decoded = jpeg.decode(image.bytes, {
    useTArray: true,
    formatAsRGBA: true,
  });

  return {
    data: new Uint8ClampedArray(decoded.data),
    width: decoded.width,
    height: decoded.height,
  };
}

function decodeImageToRgba(image: DecodedBase64Image): {
  data: Uint8ClampedArray;
  width: number;
  height: number;
} {
  if (image.mimeType === "image/png") {
    return decodePngToRgba(image);
  }

  return decodeJpegToRgba(image);
}

export function decodeQrTextFromImage(image: DecodedBase64Image): string {
  const rgba = decodeImageToRgba(image);
  const result = jsQR(rgba.data, rgba.width, rgba.height, {
    inversionAttempts: "attemptBoth",
  });

  if (!result?.data) {
    throw new Error("QR tidak bisa dibaca dari gambar");
  }

  return result.data;
}
