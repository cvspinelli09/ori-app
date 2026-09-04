const { S3Client } = require('@aws-sdk/client-s3');

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const bucket = process.env.R2_BUCKET;
const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL;

function publicUrl(key) {
  return `${publicBaseUrl}/${key}`;
}

module.exports = { r2, bucket, publicUrl };
