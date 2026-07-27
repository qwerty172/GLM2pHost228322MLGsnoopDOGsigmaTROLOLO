import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectImageMime,
  getImageDimensions,
  isStorageCoverPath,
  MIN_COVER_HEIGHT,
  MIN_COVER_WIDTH,
  validateCoverImage,
} from "../lib/coverImageValidation.js";

function makePngBuffer(width: number, height: number): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 2;
  return Buffer.concat([
    signature,
    Buffer.from([0, 0, 0, 13]),
    Buffer.from("IHDR"),
    ihdrData,
    Buffer.alloc(4),
    Buffer.from([0, 0, 0, 0]),
    Buffer.from("IEND"),
    Buffer.alloc(4),
  ]);
}

function makeJpegBuffer(width: number, height: number): Buffer {
  const sof = Buffer.alloc(13);
  sof[0] = 0xff;
  sof[1] = 0xc0;
  sof[2] = 0x00;
  sof[3] = 0x0b;
  sof[4] = 0x08;
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  sof[9] = 0x01;
  sof[10] = 0x11;
  sof[11] = 0x00;
  return Buffer.concat([Buffer.from([0xff, 0xd8]), sof]);
}

function makeWebpVp8xBuffer(width: number, height: number): Buffer {
  const buf = Buffer.alloc(30);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(22, 4);
  buf.write("WEBP", 8, "ascii");
  buf.write("VP8X", 12, "ascii");
  buf.writeUIntLE(width - 1, 24, 3);
  buf.writeUIntLE(height - 1, 27, 3);
  return buf;
}

describe("coverImageValidation", () => {
  it("detects PNG/JPEG/WebP by magic bytes", () => {
    assert.equal(detectImageMime(makePngBuffer(10, 10)), "image/png");
    assert.equal(detectImageMime(makeJpegBuffer(10, 10)), "image/jpeg");
    assert.equal(detectImageMime(makeWebpVp8xBuffer(10, 10)), "image/webp");
    assert.equal(detectImageMime(Buffer.from("plain text")), null);
  });

  it("reads dimensions from image headers", () => {
    assert.deepEqual(getImageDimensions(makePngBuffer(320, 180), "image/png"), {
      width: 320,
      height: 180,
    });
    assert.deepEqual(getImageDimensions(makeJpegBuffer(400, 200), "image/jpeg"), {
      width: 400,
      height: 200,
    });
    assert.deepEqual(getImageDimensions(makeWebpVp8xBuffer(500, 300), "image/webp"), {
      width: 500,
      height: 300,
    });
  });

  it("accepts covers at or above minimum resolution", () => {
    const exact = validateCoverImage(makePngBuffer(MIN_COVER_WIDTH, MIN_COVER_HEIGHT));
    assert.equal(exact.ok, true);
    if (exact.ok) {
      assert.equal(exact.width, MIN_COVER_WIDTH);
      assert.equal(exact.height, MIN_COVER_HEIGHT);
    }

    const larger = validateCoverImage(makeJpegBuffer(640, 360));
    assert.equal(larger.ok, true);
  });

  it("rejects too-small, non-image, and oversized buffers", () => {
    const small = validateCoverImage(makePngBuffer(200, 120));
    assert.equal(small.ok, false);
    if (!small.ok) assert.match(small.error, /300×170/);

    const fake = validateCoverImage(Buffer.from("not-an-image"));
    assert.equal(fake.ok, false);
    if (!fake.ok) assert.match(fake.error, /PNG, JPEG или WebP/);

    const huge = validateCoverImage(Buffer.alloc(2 * 1024 * 1024 + 1, 0xff));
    assert.equal(huge.ok, false);
    if (!huge.ok) assert.match(huge.error, /2 МБ/);
  });

  it("recognizes storage cover paths", () => {
    assert.equal(isStorageCoverPath("/api/storage/objects/abc"), true);
    assert.equal(isStorageCoverPath("/objects/abc"), true);
    assert.equal(isStorageCoverPath("https://cdn.example/cover.jpg"), false);
  });
});
