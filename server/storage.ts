import fs from "fs";
import path from "path";

// Ensure a local directory exists for fallback file uploads
const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

let objectStorage: any = null;

// Dynamically import the Replit App Storage SDK to bypass strict compile-time checks
// and maintain perfect portability inside other environments.
import("@replit/object-storage")
  .then((module: any) => {
    const StorageClass = module.ObjectStorage || module.objectStorage || module.default;
    if (StorageClass) {
      objectStorage = typeof StorageClass === "function" ? new StorageClass() : StorageClass;
      console.log("Replit Object Storage initialized dynamically!");
    }
  })
  .catch(() => {
    console.log("Replit Object Storage is not configured/available. Using local filesystem uploads fallback.");
  });

/**
 * Uploads a file buffer to Object Storage or falls back to local filesystem.
 * Returns the public URL of the uploaded asset.
 */
export async function uploadMedia(
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<string> {
  const extension = path.extname(originalName) || ".png";
  const fileName = `category_${Date.now()}_${Math.random().toString(36).substring(2, 10)}${extension}`;

  // Strict 30MB guardrail check on the server
  const THIRTY_MB = 30 * 1024 * 1024; // 31,457,280 bytes
  if (fileBuffer.length > THIRTY_MB) {
    throw new Error("File exceeds 30MB. Upload blocked by security guardrails.");
  }

  // Attempt to upload using Replit Object Storage
  if (objectStorage) {
    try {
      console.log(`Uploading ${fileName} to Replit Object Storage...`);
      // Most common Replit storage SDK signatures:
      const bucket = typeof objectStorage.getOrCreateBucket === "function" 
        ? await objectStorage.getOrCreateBucket("fix-home-media")
        : objectStorage;
        
      if (bucket && typeof bucket.uploadObject === "function") {
        await bucket.uploadObject(fileName, fileBuffer, {
          contentType: mimeType,
        });
        const publicUrl = typeof bucket.getPublicUrl === "function" 
          ? await bucket.getPublicUrl(fileName)
          : `/uploads/${fileName}`;
        if (publicUrl) {
          return publicUrl;
        }
      }
    } catch (err) {
      console.error("Replit Object Storage upload failed, falling back to local storage:", err);
    }
  }

  // Local filesystem fallback
  const destinationPath = path.join(UPLOADS_DIR, fileName);
  fs.writeFileSync(destinationPath, fileBuffer);
  console.log(`Saved file locally to ${destinationPath}`);

  // Return the public server URL
  return `/uploads/${fileName}`;
}
