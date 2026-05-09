import { Injectable, Logger } from "@nestjs/common";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { CreatePhotoDto } from "@/site-reports/dto/create-photo.dto";

type ExtractedExifMetadata = {
  gpsLat?: number;
  gpsLng?: number;
  takenAt?: string;
  thumbnailDataUrl?: string;
};

@Injectable()
export class PhotoMetadataService {
  private readonly logger = new Logger(PhotoMetadataService.name);

  async enrichPhotoPayload(payload: CreatePhotoDto) {
    const needsExif =
      payload.gpsLat == null ||
      payload.gpsLng == null ||
      !payload.takenAt ||
      !payload.thumbnailUrl;

    const binary = needsExif ? await this.readPhotoBytes(payload.fileUrl) : null;
    const exif = binary ? this.extractExifMetadata(binary) : {};

    return {
      ...payload,
      gpsLat: payload.gpsLat ?? exif.gpsLat,
      gpsLng: payload.gpsLng ?? exif.gpsLng,
      takenAt: payload.takenAt ?? exif.takenAt,
      thumbnailUrl: payload.thumbnailUrl?.trim() || exif.thumbnailDataUrl || payload.fileUrl,
    };
  }

  private async readPhotoBytes(fileUrl: string) {
    try {
      if (fileUrl.startsWith("data:")) {
        const match = /^data:([^;]+);base64,(.+)$/i.exec(fileUrl);
        if (!match) {
          return null;
        }

        return Buffer.from(match[2], "base64");
      }

      if (fileUrl.startsWith("file://")) {
        return readFile(fileURLToPath(fileUrl));
      }

      if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
        const response = await fetch(fileUrl, {
          signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
          return null;
        }

        return Buffer.from(await response.arrayBuffer());
      }
    } catch (error) {
      this.logger.warn(
        `Could not load photo binary for EXIF enrichment: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return null;
  }

  private extractExifMetadata(buffer: Buffer): ExtractedExifMetadata {
    if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
      return {};
    }

    let offset = 2;
    while (offset + 4 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }

      const marker = buffer[offset + 1];
      if (marker === 0xda || marker === 0xd9) {
        break;
      }

      const segmentLength = buffer.readUInt16BE(offset + 2);
      if (segmentLength < 2 || offset + 2 + segmentLength > buffer.length) {
        break;
      }

      if (
        marker === 0xe1 &&
        buffer.slice(offset + 4, offset + 10).toString("ascii") === "Exif\u0000\u0000"
      ) {
        return this.parseTiffBlock(buffer, offset + 10);
      }

      offset += 2 + segmentLength;
    }

    return {};
  }

  private parseTiffBlock(buffer: Buffer, tiffStart: number): ExtractedExifMetadata {
    const endianToken = buffer.slice(tiffStart, tiffStart + 2).toString("ascii");
    const littleEndian = endianToken === "II";
    if (!littleEndian && endianToken !== "MM") {
      return {};
    }

    const readUInt16 = (position: number) =>
      littleEndian ? buffer.readUInt16LE(position) : buffer.readUInt16BE(position);
    const readUInt32 = (position: number) =>
      littleEndian ? buffer.readUInt32LE(position) : buffer.readUInt32BE(position);

    const readEntryValueOffset = (entryOffset: number, type: number, count: number) => {
      const byteLength = this.getExifValueByteLength(type, count);
      return byteLength <= 4 ? entryOffset + 8 : tiffStart + readUInt32(entryOffset + 8);
    };

    const firstIfdOffset = readUInt32(tiffStart + 4);
    if (!firstIfdOffset) {
      return {};
    }

    const ifd0Offset = tiffStart + firstIfdOffset;
    const ifd0 = this.readIfd(buffer, ifd0Offset, readUInt16, readUInt32);
    let gpsOffset = 0;
    let exifOffset = 0;

    for (const entryOffset of ifd0.entries) {
      const tag = readUInt16(entryOffset);
      const type = readUInt16(entryOffset + 2);
      const count = readUInt32(entryOffset + 4);
      const valueOffset = readEntryValueOffset(entryOffset, type, count);

      if (tag === 0x8825) {
        gpsOffset = tiffStart + readUInt32(entryOffset + 8);
      }

      if (tag === 0x8769) {
        exifOffset = tiffStart + readUInt32(entryOffset + 8);
      }

      if (type === 0 && count === 0 && valueOffset === 0) {
        continue;
      }
    }

    const metadata: ExtractedExifMetadata = {};

    if (exifOffset) {
      const exifIfd = this.readIfd(buffer, exifOffset, readUInt16, readUInt32);
      for (const entryOffset of exifIfd.entries) {
        const tag = readUInt16(entryOffset);
        const type = readUInt16(entryOffset + 2);
        const count = readUInt32(entryOffset + 4);
        const valueOffset = readEntryValueOffset(entryOffset, type, count);

        if (tag === 0x9003) {
          const raw = this.readAscii(buffer, valueOffset, count);
          const normalized = this.normalizeExifDate(raw);
          if (normalized) {
            metadata.takenAt = normalized;
          }
        }
      }
    }

    if (gpsOffset) {
      const gpsIfd = this.readIfd(buffer, gpsOffset, readUInt16, readUInt32);
      let latRef = "N";
      let lngRef = "E";
      let latValues: number[] = [];
      let lngValues: number[] = [];

      for (const entryOffset of gpsIfd.entries) {
        const tag = readUInt16(entryOffset);
        const type = readUInt16(entryOffset + 2);
        const count = readUInt32(entryOffset + 4);
        const valueOffset = readEntryValueOffset(entryOffset, type, count);

        if (tag === 0x0001) {
          latRef = this.readAscii(buffer, valueOffset, count).trim() || latRef;
        }

        if (tag === 0x0002) {
          latValues = this.readRationals(buffer, valueOffset, count, littleEndian);
        }

        if (tag === 0x0003) {
          lngRef = this.readAscii(buffer, valueOffset, count).trim() || lngRef;
        }

        if (tag === 0x0004) {
          lngValues = this.readRationals(buffer, valueOffset, count, littleEndian);
        }
      }

      if (latValues.length >= 3) {
        metadata.gpsLat = this.toDecimalDegrees(latValues, latRef);
      }

      if (lngValues.length >= 3) {
        metadata.gpsLng = this.toDecimalDegrees(lngValues, lngRef);
      }
    }

    if (ifd0.nextIfdOffset) {
      const ifd1Offset = tiffStart + ifd0.nextIfdOffset;
      const ifd1 = this.readIfd(buffer, ifd1Offset, readUInt16, readUInt32);
      let thumbnailOffset = 0;
      let thumbnailLength = 0;

      for (const entryOffset of ifd1.entries) {
        const tag = readUInt16(entryOffset);
        if (tag === 0x0201) {
          thumbnailOffset = tiffStart + readUInt32(entryOffset + 8);
        }

        if (tag === 0x0202) {
          thumbnailLength = readUInt32(entryOffset + 8);
        }
      }

      if (thumbnailOffset && thumbnailLength) {
        const thumbnailBuffer = buffer.subarray(
          thumbnailOffset,
          thumbnailOffset + thumbnailLength,
        );
        if (thumbnailBuffer.length > 0) {
          metadata.thumbnailDataUrl = `data:image/jpeg;base64,${thumbnailBuffer.toString("base64")}`;
        }
      }
    }

    return metadata;
  }

  private readIfd(
    buffer: Buffer,
    ifdOffset: number,
    readUInt16: (position: number) => number,
    readUInt32: (position: number) => number,
  ) {
    if (ifdOffset <= 0 || ifdOffset + 2 > buffer.length) {
      return { entries: [] as number[], nextIfdOffset: 0 };
    }

    const entryCount = readUInt16(ifdOffset);
    const entries: number[] = [];
    for (let index = 0; index < entryCount; index += 1) {
      entries.push(ifdOffset + 2 + index * 12);
    }

    const nextIfdPosition = ifdOffset + 2 + entryCount * 12;
    const nextIfdOffset =
      nextIfdPosition + 4 <= buffer.length ? readUInt32(nextIfdPosition) : 0;

    return { entries, nextIfdOffset };
  }

  private getExifValueByteLength(type: number, count: number) {
    const bytesPerValue = new Map<number, number>([
      [1, 1],
      [2, 1],
      [3, 2],
      [4, 4],
      [5, 8],
      [7, 1],
      [9, 4],
      [10, 8],
    ]);

    return (bytesPerValue.get(type) ?? 1) * count;
  }

  private readAscii(buffer: Buffer, offset: number, count: number) {
    return buffer
      .slice(offset, offset + Math.max(count - 1, 0))
      .toString("ascii")
      .replace(/\0+$/, "");
  }

  private readRationals(
    buffer: Buffer,
    offset: number,
    count: number,
    littleEndian: boolean,
  ) {
    const values: number[] = [];
    for (let index = 0; index < count; index += 1) {
      const partOffset = offset + index * 8;
      if (partOffset + 8 > buffer.length) {
        break;
      }

      const numerator = littleEndian
        ? buffer.readUInt32LE(partOffset)
        : buffer.readUInt32BE(partOffset);
      const denominator = littleEndian
        ? buffer.readUInt32LE(partOffset + 4)
        : buffer.readUInt32BE(partOffset + 4);

      if (denominator !== 0) {
        values.push(numerator / denominator);
      }
    }

    return values;
  }

  private toDecimalDegrees(parts: number[], ref: string) {
    const decimal = parts[0] + parts[1] / 60 + parts[2] / 3600;
    return ref === "S" || ref === "W" ? -decimal : decimal;
  }

  private normalizeExifDate(raw: string) {
    const match = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(raw.trim());
    if (!match) {
      return null;
    }

    const [, year, month, day, hour, minute, second] = match;
    return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
  }
}
