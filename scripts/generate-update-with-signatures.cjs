#!/usr/bin/env node

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

/*
 Improved generate-update-with-signatures script
 - async, parallel signature reads
 - safer file operations (check existence before copy)
 - simple CLI flags: --version, --notes, --base-url, --help
 - clear logging and non-zero exit codes on fatal errors
*/

function printHelp() {
  console.log(`
Usage:
  node scripts/generate-update-with-signatures.cjs --version 1.0.1 [--notes "..."] [--base-url "..."]

This script reads produced signature files and artifacts from src-tauri/target/* and generates release/updates.json
`);
}

function parseArgs(argv) {
  const out = { version: null, notes: null, baseUrl: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      out.help = true;
      break;
    }
    if (a === '--version' && argv[i + 1]) {
      out.version = argv[++i];
      continue;
    }
    if (a === '--notes' && argv[i + 1]) {
      out.notes = argv[++i];
      continue;
    }
    if (a === '--base-url' && argv[i + 1]) {
      out.baseUrl = argv[++i];
      continue;
    }
  }
  return out;
}

const args = parseArgs(process.argv);
if (args.help) {
  printHelp();
  process.exit(0);
}

const config = {
  version: args.version || process.argv[2] || '1.0.1',
  notes: args.notes || process.argv[3] || 'FileSortify 版本更新',
  pubDate: new Date().toISOString(),
  baseUrl:
    args.baseUrl ||
    'https://filesortify.geekfan-bo.workers.dev/FileSortify/releases',
};

const workspaceRoot = path.join(__dirname, '..');

// platforms definition drives both signature lookup and artifact copy
const PLATFORMS = [
  {
    id: 'darwin-aarch64',
    targetDirSegments: [
      'src-tauri',
      'target',
      'aarch64-apple-darwin',
      'release',
      'bundle',
    ],
    sigRel: ['macos', 'File Sortify.app.tar.gz.sig'],
    tarRel: ['macos', 'File Sortify.app.tar.gz'],
    dmgRel: ['dmg', `File Sortify_${config.version}_aarch64.dmg`],
    publicUrl: (v) =>
      `${config.baseUrl}/v${v}/darwin-aarch64/File Sortify.app.tar.gz`,
  },
  {
    id: 'darwin-x86_64',
    targetDirSegments: [
      'src-tauri',
      'target',
      'x86_64-apple-darwin',
      'release',
      'bundle',
    ],
    sigRel: ['macos', 'File Sortify.app.tar.gz.sig'],
    tarRel: ['macos', 'File Sortify.app.tar.gz'],
    dmgRel: ['dmg', `File Sortify_${config.version}_x64.dmg`],
    publicUrl: (v) =>
      `${config.baseUrl}/v${v}/darwin-x86_64/File Sortify.app.tar.gz`,
  },
  {
    id: 'linux-x86_64',
    targetDirSegments: [
      'src-tauri',
      'target',
      'aarch64-apple-darwin',
      'release',
      'bundle',
    ],
    sigRel: ['macos', 'File Sortify.app.tar.gz.sig'],
    tarRel: ['macos', 'File Sortify.app.tar.gz'],
    dmgRel: ['dmg', `File Sortify_${config.version}_aarch64.dmg`],
    publicUrl: (v) =>
      `${config.baseUrl}/v${v}/linux-x86_64/File Sortify.app.tar.gz`,
  },
  {
    id: 'windows-x86_64',
    targetDirSegments: [
      'src-tauri',
      'target',
      'aarch64-apple-darwin',
      'release',
      'bundle',
    ],
    sigRel: ['macos', 'File Sortify.app.tar.gz.sig'],
    tarRel: ['macos', 'File Sortify.app.tar.gz'],
    dmgRel: ['dmg', `File Sortify_${config.version}_aarch64.dmg`],
    publicUrl: (v) =>
      `${config.baseUrl}/v${v}/windows-x86_64/File Sortify.app.tar.gz`,
  },
  // "linux-x86_64": {
  //           "signature": "",
  //           "url": "https://oss.picasso-designs.com/FileSortify/releases/v1.0.1/File%20Sortify_amd64.AppImage"
  //       },
  //       "windows-x86_64": {
  //           "signature": "",
  //           "url": "https://oss.picasso-designs.com/FileSortify/releases/v1.0.1/File%20Sortify_x64_en-US.msi"
  //       }
  // add linux / windows entries here when supported
];

async function readSignatureFile(filePath) {
  try {
    const stat = await fsp.stat(filePath).catch(() => null);
    if (!stat || !stat.isFile()) {
      console.warn(`⚠️  签名文件不存在: ${filePath}`);
      return '';
    }
    const content = await fsp.readFile(filePath, 'utf8');
    return content.trim();
  } catch (err) {
    console.warn(`⚠️  读取签名文件失败: ${filePath} — ${err.message}`);
    return '';
  }
}

function ensureDir(dir) {
  return fsp.mkdir(dir, { recursive: true }).catch(() => {});
}

async function fileExists(p) {
  try {
    const st = await fsp.stat(p);
    return st.isFile() || st.isFIFO();
  } catch (e) {
    return false;
  }
}

async function gatherSignatures() {
  const promises = PLATFORMS.map(async (p) => {
    const targetDir = path.join(workspaceRoot, ...p.targetDirSegments);
    const sigPath = path.join(targetDir, ...p.sigRel);
    const sig = await readSignatureFile(sigPath);
    return { id: p.id, signature: sig, sigPath };
  });
  const results = await Promise.all(promises);
  return results.reduce((acc, r) => {
    acc[r.id] = { signature: r.signature, path: r.sigPath };
    return acc;
  }, {});
}

async function buildUpdateJson(signatures) {
  const platforms = {};
  for (const p of PLATFORMS) {
    platforms[p.id] = {
      signature: signatures[p.id] ? signatures[p.id].signature : '',
      url: p.publicUrl(config.version),
    };
  }
  return {
    version: config.version,
    notes: config.notes,
    pub_date: config.pubDate,
    platforms,
  };
}

async function writeUpdateJson(jsonObj) {
  const outputDir = path.join(workspaceRoot, 'release');
  await ensureDir(outputDir);
  const outputPath = path.join(outputDir, 'updates.json');
  await fsp.writeFile(outputPath, JSON.stringify(jsonObj, null, 2), 'utf8');
  return outputPath;
}

async function copyArtifacts() {
  for (const p of PLATFORMS) {
    const targetDir = path.join(workspaceRoot, ...p.targetDirSegments);
    const sigPath = path.join(targetDir, ...p.sigRel);
    const tarPath = path.join(targetDir, ...p.tarRel);
    const dmgPath = path.join(targetDir, ...p.dmgRel);

    const releaseDir = path.join(
      workspaceRoot,
      'release',
      `v${config.version}`,
      p.id
    );
    await ensureDir(releaseDir);

    const copies = [
      {
        src: sigPath,
        dest: path.join(releaseDir, 'File Sortify.app.tar.gz.sig'),
      },
      { src: tarPath, dest: path.join(releaseDir, 'File Sortify.app.tar.gz') },
      { src: dmgPath, dest: path.join(releaseDir, path.basename(dmgPath)) },
    ];

    for (const c of copies) {
      if (await fileExists(c.src)) {
        try {
          await fsp.copyFile(c.src, c.dest);
          console.log(`Copied: ${c.src} -> ${c.dest}`);
        } catch (err) {
          console.warn(`Failed to copy ${c.src} -> ${c.dest}: ${err.message}`);
        }
      } else {
        console.warn(`跳过（未找到）: ${c.src}`);
      }
    }
  }
}

async function main() {
  try {
    console.log('🔎 收集签名...');
    const signatures = await gatherSignatures();

    console.log('\n📋 签名状态:');
    Object.entries(signatures).forEach(([k, v]) => {
      console.log(
        `  ${v.signature ? '✅' : '❌'} ${k}: ${
          v.signature ? '已找到签名' : '未找到签名'
        } (${v.path})`
      );
    });

    const anyMissing = Object.values(signatures).some((s) => !s.signature);
    if (anyMissing) {
      console.warn('\n⚠️  注意：某些签名缺失。请确认已构建或路径正确。');
    }

    const updateJson = await buildUpdateJson(signatures);
    const outputPath = await writeUpdateJson(updateJson);
    console.log(`\n✅ 更新 JSON 文件已生成: ${outputPath}`);
    console.log(`📦 版本: ${config.version}`);
    console.log(`📝 说明: ${config.notes}`);
    console.log(`🔗 端点: ${config.baseUrl}/updates.json`);

    console.log('\n📦 复制产物到 release 目录（存在的文件）...');
    await copyArtifacts();

    console.log('\n✅ 完成。');
  } catch (err) {
    console.error('❌ 脚本执行失败:', err);
    process.exitCode = 2;
  }
}

main();
