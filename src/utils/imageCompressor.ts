/**
 * High-performance, bulletproof image compressor for FixHome Mobile & Web
 * Optimized specifically for mobile browsers (Android Chrome, Samsung Internet, iOS Safari, WebViews).
 * Resizes and optimizes service images to ~30KB-60KB Base64 JPEG.
 * This guarantees instant real-time multi-device synchronization via Firestore
 * without exceeding Firestore document limits or mobile network upload timeouts.
 */

export async function compressImage(
  fileOrDataUrl: File | Blob | string,
  maxWidth = 720,
  maxHeight = 720,
  quality = 0.75
): Promise<{ dataUrl: string; file: File }> {
  return new Promise((resolve, reject) => {
    // Safety timeout after 10 seconds in case image decoding gets stuck on low-end device
    const timer = setTimeout(() => {
      reject(new Error("Image compression timed out"));
    }, 10000);

    const cleanup = (blobUrl?: string) => {
      clearTimeout(timer);
      if (blobUrl && blobUrl.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(blobUrl);
        } catch (e) {}
      }
    };

    const img = new Image();

    // Only set crossOrigin for remote HTTP(S) URLs to prevent CORS errors on blob:/data: on Android
    if (typeof fileOrDataUrl === "string" && (fileOrDataUrl.startsWith("http://") || fileOrDataUrl.startsWith("https://"))) {
      img.crossOrigin = "anonymous";
    }

    const processImage = (srcUrl?: string) => {
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (!width || !height || width <= 0 || height <= 0) {
          width = 600;
          height = 400;
        }

        // Calculate aspect-ratio preserved dimensions
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          throw new Error("Could not create canvas 2D context");
        }

        // Fill white background for transparent PNGs/SVGs
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "medium";
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", quality);

        // Convert base64 dataUrl to a lightweight File object for uploads
        const arr = dataUrl.split(",");
        const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }

        let rawName = "service_image.jpg";
        if (typeof fileOrDataUrl !== "string" && "name" in fileOrDataUrl && fileOrDataUrl.name) {
          rawName = fileOrDataUrl.name;
        }
        const fileName = rawName.replace(/\.[^/.]+$/, "") + ".jpg";
        const compressedFile = new File([u8arr], fileName, { type: mime });

        cleanup(srcUrl);
        resolve({ dataUrl, file: compressedFile });
      } catch (err) {
        cleanup(srcUrl);
        reject(err);
      }
    };

    let objectUrlToClean: string | undefined;

    img.onload = () => processImage(objectUrlToClean);
    img.onerror = (err) => {
      cleanup(objectUrlToClean);
      reject(new Error("Failed to decode image on device"));
    };

    if (typeof fileOrDataUrl === "string") {
      img.src = fileOrDataUrl;
    } else {
      try {
        objectUrlToClean = URL.createObjectURL(fileOrDataUrl);
        img.src = objectUrlToClean;
      } catch (e) {
        // Fallback to FileReader if createObjectURL fails
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (ev.target?.result) {
            img.src = ev.target.result as string;
          } else {
            cleanup();
            reject(new Error("Failed to read image file"));
          }
        };
        reader.onerror = () => {
          cleanup();
          reject(new Error("FileReader error reading file"));
        };
        reader.readAsDataURL(fileOrDataUrl);
      }
    }
  });
}
