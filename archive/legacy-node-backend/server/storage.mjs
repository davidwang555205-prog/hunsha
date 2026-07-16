// MinIO / S3 对象存储访问层
// 图片存 MinIO（S3 兼容），访问统一经后端代理（serveGenerated），不暴露 MinIO 直连给前端。
import { S3Client, PutObjectCommand, GetObjectCommand, HeadBucketCommand, CreateBucketCommand } from "@aws-sdk/client-s3";

let s3Client = null;
function getClient() {
  if (s3Client) return s3Client;
  s3Client = new S3Client({
    endpoint: process.env.MINIO_ENDPOINT || "http://127.0.0.1:9000",
    region: "us-east-1",
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY || "minioadmin",
      secretAccessKey: process.env.MINIO_SECRET_KEY || "change_me"
    },
    forcePathStyle: true // MinIO 必须 path-style
  });
  return s3Client;
}

function getBucket() {
  return process.env.MINIO_BUCKET || "bridal-images";
}

// 启动时确保 bucket 存在（幂等）
export async function ensureBucket() {
  const client = getClient();
  const bucket = getBucket();
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return;
  } catch {
    // bucket 不存在或不可访问，尝试创建
  }
  try {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`[storage] bucket ${bucket} 已创建`);
  } catch (err) {
    // 已存在则忽略
    if (!String(err?.name || "").includes("BucketAlready")) {
      console.error(`[storage] ensureBucket 失败: ${err.message}`);
    }
  }
}

export async function putImage(key, buffer, contentType) {
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: buffer,
      ContentType: contentType || "image/png"
    })
  );
}

export async function getImageStream(key) {
  const client = getClient();
  const response = await client.send(
    new GetObjectCommand({ Bucket: getBucket(), Key: key })
  );
  return response.Body; // Node 环境下为 Readable 流
}
