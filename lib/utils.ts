import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}
export async function optimizeImage(file: File, maxWidth = 1200, quality = 0.8): Promise<File> {
  return new Promise((resolve) => {
    // Fallback timer: if optimization takes more than 10 seconds, return original file
    const timeout = setTimeout(() => {
      console.warn("Optimization timed out for:", file.name);
      resolve(file);
    }, 10000);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new window.Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > maxWidth) {
                height *= maxWidth / width;
                width = maxWidth;
              }
            } else {
              if (height > maxWidth) {
                width *= maxWidth / height;
                height = maxWidth;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              clearTimeout(timeout);
              resolve(file);
              return;
            }
            
            ctx.drawImage(img, 0, 0, width, height);

            if (!canvas.toBlob) {
              clearTimeout(timeout);
              resolve(file);
              return;
            }

            canvas.toBlob(
              (blob) => {
                clearTimeout(timeout);
                if (blob) {
                  resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
                } else {
                  resolve(file);
                }
              },
              'image/jpeg',
              quality
            );
          } catch (e) {
            console.error("Canvas optimization error:", e);
            clearTimeout(timeout);
            resolve(file);
          }
        };
        img.onerror = () => {
          console.error("Image load error for optimization");
          clearTimeout(timeout);
          resolve(file);
        };
      };
      reader.onerror = () => {
        console.error("FileReader error for optimization");
        clearTimeout(timeout);
        resolve(file);
      };
    } catch (err) {
      console.error("General optimization error:", err);
      clearTimeout(timeout);
      resolve(file);
    }
  });
}
