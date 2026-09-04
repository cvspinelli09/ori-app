// Sobe todas as fotos de ori-demo/images_full/ pro bucket R2, preservando o
// mesmo caminho relativo como chave (bate com foto_local/foto_local_gde no banco).
// Uso: node scripts/upload-photos-to-r2.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const { PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { r2, bucket } = require('../lib/r2');

const rootDir = path.join(__dirname, '..', '..'); // ori-demo/
const imagesDir = path.join(rootDir, 'images_full');

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files = files.concat(walk(full));
    else files.push(full);
  }
  return files;
}

async function alreadyExists(key) {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function uploadFile(filePath) {
  const key = path.relative(rootDir, filePath).replace(/\\/g, '/');
  if (await alreadyExists(key)) return { key, skipped: true };

  const body = fs.readFileSync(filePath);
  const contentType = mime.lookup(filePath) || 'application/octet-stream';
  await r2.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType })
  );
  return { key, skipped: false };
}

async function main() {
  const files = walk(imagesDir);
  console.log(`Encontrados ${files.length} arquivos em images_full/`);

  const concurrency = 15;
  let done = 0;
  let uploaded = 0;
  let skipped = 0;

  let idx = 0;
  async function worker() {
    while (idx < files.length) {
      const myIdx = idx++;
      const result = await uploadFile(files[myIdx]);
      done++;
      if (result.skipped) skipped++;
      else uploaded++;
      if (done % 200 === 0 || done === files.length) {
        console.log(`${done}/${files.length} (novos: ${uploaded}, já existiam: ${skipped})`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  console.log('Concluído.');
}

main();
