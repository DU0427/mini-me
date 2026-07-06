// 生成一个简单的 64x64 蓝色圆角正方形图标
const fs = require("fs");
const path = require("path");

// 最小有效 PNG：64x64 蓝色圆角方块
// 用原始 PNG 数据生成
function createMinimalPNG() {
  // PNG 文件结构
  const width = 64,
    height = 64;

  // IHDR 数据
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); // width
  ihdr.writeUInt32BE(height, 4); // height
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // 图像数据 (每个像素 RGB, 无 alpha)
  const rawData = Buffer.alloc(height * (1 + width * 3)); // filter byte + RGB per row
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 3);
    rawData[rowOffset] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const px = rowOffset + 1 + x * 3;
      // 圆角检测
      const cx = x - width / 2,
        cy = y - height / 2;
      const cornerR = 10;
      const inCircle = (dx, dy) => Math.sqrt(dx * dx + dy * dy) <= cornerR;

      let inRect = true;
      // 四个角裁剪
      if (x < cornerR && y < cornerR)
        inRect = inCircle(x - cornerR, y - cornerR);
      else if (x >= width - cornerR && y < cornerR)
        inRect = inCircle(x - (width - 1 - cornerR), y - cornerR);
      else if (x < cornerR && y >= height - cornerR)
        inRect = inCircle(x - cornerR, y - (height - 1 - cornerR));
      else if (x >= width - cornerR && y >= height - cornerR)
        inRect = inCircle(
          x - (width - 1 - cornerR),
          y - (height - 1 - cornerR),
        );

      if (inRect) {
        // 渐变蓝背景
        const dist =
          Math.sqrt(
            (x - width / 2) * (x - width / 2) +
              (y - height / 2) * (y - height / 2),
          ) /
          (width / 2);
        const r = Math.round(70 + (1 - dist) * 40);
        const g = Math.round(100 + (1 - dist) * 68);
        const b = Math.round(200 + (1 - dist) * 55);
        rawData[px] = Math.min(255, r);
        rawData[px + 1] = Math.min(255, g);
        rawData[px + 2] = Math.min(255, b);
      } else {
        rawData[px] = 0;
        rawData[px + 1] = 0;
        rawData[px + 2] = 0;
      }
    }
  }

  // 压缩 (使用 zlib)
  const zlib = require("zlib");
  const compressed = zlib.deflateSync(rawData);

  // 辅助函数
  function crc32(buf) {
    let crc = 0xffffffff;
    const table = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c;
    }
    for (let i = 0; i < buf.length; i++)
      crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const t = Buffer.from(type, "ascii");
    const crcData = Buffer.concat([t, data]);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(crcData));
    return Buffer.concat([len, t, data, crcBuf]);
  }

  // 构建 PNG
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrChunk = chunk("IHDR", ihdr);
  const idatChunk = chunk("IDAT", compressed);
  const iendChunk = chunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const png = createMinimalPNG();
const outPath = path.join(__dirname, "..", "assets", "icon.png");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, png);
console.log("图标已生成:", outPath, `(${png.length} bytes)`);
