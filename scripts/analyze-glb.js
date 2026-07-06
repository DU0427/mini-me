/**
 * 分析 GLB 模型的骨骼结构
 * 使用方式: node scripts/analyze-glb.js
 */
const fs = require("fs");
const path = require("path");

// 读取 GLB 文件
const glbPath = path.join(__dirname, "..", "public", "models", "avatar.glb");
const buffer = fs.readFileSync(glbPath);

// GLB Header 解析
const magic = buffer.readUInt32LE(0);
const version = buffer.readUInt32LE(4);
const totalLength = buffer.readUInt32LE(8);

console.log(`=== GLB 文件信息 ===`);
console.log(
  `Magic: 0x${magic.toString(16)} (${magic === 0x46546c67 ? "glTF" : "未知"})`,
);
console.log(`版本: ${version}`);
console.log(`文件大小: ${totalLength} bytes`);

// 解析各个 chunk
let offset = 12; // header 12 bytes
const chunks = [];
while (offset < buffer.length) {
  const chunkLength = buffer.readUInt32LE(offset);
  const chunkType = buffer.readUInt32LE(offset + 4);
  const chunkData = buffer.slice(offset + 8, offset + 8 + chunkLength);
  chunks.push({ type: chunkType, length: chunkLength, data: chunkData });
  offset += 8 + chunkLength;
}

console.log(`\n=== Chunks (${chunks.length}个) ===`);
for (const chunk of chunks) {
  const typeStr =
    chunk.type === 0x4e4f534a
      ? "JSON"
      : chunk.type === 0x004e4942
        ? "BIN"
        : `0x${chunk.type.toString(16)}`;
  console.log(`  ${typeStr}: ${chunk.length} bytes`);
}

// 解析 JSON 部分
const jsonChunk = chunks.find((c) => c.type === 0x4e4f534a);
if (!jsonChunk) {
  console.error("未找到 JSON chunk");
  process.exit(1);
}

const gltf = JSON.parse(jsonChunk.data.toString("utf8"));

console.log(`\n=== glTF 基本信息 ===`);
console.log(`asset:`, JSON.stringify(gltf.asset));
console.log(`场景数: ${gltf.scenes?.length || 0}`);
console.log(`节点数: ${gltf.nodes?.length || 0}`);
console.log(`网格数: ${gltf.meshes?.length || 0}`);
console.log(`骨骼数 (skins): ${gltf.skins?.length || 0}`);
console.log(`动画数: ${gltf.animations?.length || 0}`);

// 打印所有节点名称
console.log(`\n=== 所有节点 (${gltf.nodes?.length || 0}个) ===`);
if (gltf.nodes) {
  gltf.nodes.forEach((node, i) => {
    const children = node.children
      ? `, 子节点: [${node.children.join(", ")}]`
      : "";
    const mesh = node.mesh !== undefined ? `, mesh: ${node.mesh}` : "";
    const skin = node.skin !== undefined ? `, skin: ${node.skin}` : "";
    console.log(
      `  [${i}] ${node.name || "(unnamed)"}${children}${mesh}${skin}`,
    );
  });
}

// 打印骨骼 (skins) 信息
console.log(`\n=== 骨骼系统 (Skins) ===`);
if (gltf.skins) {
  gltf.skins.forEach((skin, i) => {
    console.log(`\n  Skin [${i}]:`);
    console.log(`    名称: ${skin.name || "(unnamed)"}`);
    console.log(`    骨骼关节 (joints):`);
    if (skin.joints) {
      skin.joints.forEach((jointIdx) => {
        const node = gltf.nodes[jointIdx];
        console.log(`      [${jointIdx}] ${node?.name || "(unnamed)"}`);
      });
    }
    console.log(
      `    InverseBindMatrices accessor: ${skin.inverseBindMatrices}`,
    );
  });
}

// 打印骨骼层级关系
console.log(`\n=== 骨骼层级关系 ===`);
function printNodeHierarchy(nodeIdx, indent = "", visited = new Set()) {
  if (visited.has(nodeIdx)) return;
  visited.add(nodeIdx);
  const node = gltf.nodes[nodeIdx];
  if (!node) return;
  const isJoint = gltf.skins?.some((s) => s.joints.includes(nodeIdx));
  const marker = isJoint ? " [BONE]" : "";
  console.log(`${indent}├─ [${nodeIdx}] ${node.name || "(unnamed)"}${marker}`);
  if (node.children) {
    node.children.forEach((childIdx, i) => {
      const isLast = i === node.children.length - 1;
      printNodeHierarchy(childIdx, indent + (isLast ? "   " : "│  "), visited);
    });
  }
}

// Find root nodes (nodes not referenced as children by any other node)
const allChildren = new Set();
if (gltf.nodes) {
  gltf.nodes.forEach((node) => {
    if (node.children) node.children.forEach((c) => allChildren.add(c));
  });
}
const rootNodes = [];
if (gltf.nodes) {
  gltf.nodes.forEach((_, i) => {
    if (!allChildren.has(i)) rootNodes.push(i);
  });
}

console.log(`根节点: [${rootNodes.join(", ")}]`);
rootNodes.forEach((idx) => printNodeHierarchy(idx));

// 如有场景，打印场景结构
if (gltf.scenes) {
  console.log(`\n=== 场景 ${gltf.scene || 0} 节点 ===`);
  const scene = gltf.scenes[gltf.scene || 0];
  if (scene) {
    scene.nodes?.forEach((idx) => printNodeHierarchy(idx));
  }
}

// 打印动画信息
if (gltf.animations) {
  console.log(`\n=== 动画 (${gltf.animations.length}个) ===`);
  gltf.animations.forEach((anim, i) => {
    console.log(`  [${i}] ${anim.name || "(unnamed)"}`);
    anim.channels?.forEach((ch, j) => {
      const targetNode = gltf.nodes[ch.target?.node];
      console.log(
        `    Channel ${j}: node=[${ch.target?.node}] ${targetNode?.name || "(unnamed)"}, path=${ch.target?.path}`,
      );
    });
  });
}
