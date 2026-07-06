const fs = require("fs");
const path = require("path");

function analyzeModel(filename) {
  const glbPath = path.join(__dirname, "..", "public", "models", filename);
  if (!fs.existsSync(glbPath)) {
    console.log(`\n=== ${filename}: 不存在 ===`);
    return;
  }
  const buffer = fs.readFileSync(glbPath);
  let offset = 12;
  while (offset < buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    if (chunkType === 0x4e4f534a) {
      const jsonStr = buffer
        .slice(offset + 8, offset + 8 + chunkLength)
        .toString("utf8");
      const gltf = JSON.parse(jsonStr);
      console.log(`\n========== ${filename} ==========`);
      console.log(`asset:`, JSON.stringify(gltf.asset));
      console.log(
        `节点数: ${gltf.nodes?.length || 0}, 骨骼数 (skins): ${gltf.skins?.length || 0}`,
      );

      const keyBoneNames = [
        "Head",
        "LeftArm",
        "RightArm",
        "LeftForeArm",
        "RightForeArm",
        "LeftUpLeg",
        "RightUpLeg",
        "Spine",
        "Hips",
        "Neck",
      ];

      if (gltf.skins && gltf.skins[0]) {
        const bones = gltf.skins[0].joints.map((idx) => gltf.nodes[idx].name);
        console.log(`\n所有骨骼名称 (前30个):`);
        bones.slice(0, 30).forEach((b) => console.log(`  ${b}`));

        console.log(`\n关键骨骼匹配:`);
        for (const key of keyBoneNames) {
          const found = bones.filter((b) =>
            b.toLowerCase().includes(key.toLowerCase()),
          );
          if (found.length > 0) {
            console.log(`  ${key}: ${found.join(", ")}`);
          } else {
            console.log(`  ${key}: ❌ 未找到`);
          }
        }
        console.log(`\n骨架总骨骼数: ${bones.length}`);
      }
      break;
    }
    offset += 8 + chunkLength;
  }
}

["robot.glb", "robot2.glb", "xbot.glb", "michelle.glb"].forEach(analyzeModel);
