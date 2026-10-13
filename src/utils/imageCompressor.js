/**
 * Compresor de imágenes en cliente usando HTML5 Canvas API.
 * Reduce fotos de cámaras de celular (4MB - 12MB) a ~60KB - 120KB
 * preservando nitidez para evidencia de entrega.
 *
 * @param {File|Blob} file - Archivo de imagen original
 * @param {Object} options - Parámetros de compresión
 * @param {number} options.maxWidth - Ancho máximo (por defecto 1200px)
 * @param {number} options.maxHeight - Alto máximo (por defecto 1200px)
 * @param {number} options.quality - Calidad JPEG de 0 a 1 (por defecto 0.68)
 * @returns {Promise<{ base64: string, originalSize: number, compressedSize: number, reductionPercent: string }>}
 */
export const comprimirFotoEntrega = (file, options = {}) => {
  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.68
  } = options;

  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('El archivo seleccionado no es una imagen válida.'));
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calcular escalado proporcional
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo inicializar el contexto de canvas.'));
          return;
        }

        // Fondo blanco para evitar fondos transparentes negros en JPG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // Dibujar imagen redimensionada
        ctx.drawImage(img, 0, 0, width, height);

        // Convertir a JPEG con compresión controlada
        const base64 = canvas.toDataURL('image/jpeg', quality);

        // Calcular peso aproximado del base64 resultante
        const base64Length = base64.length - (base64.indexOf(',') + 1);
        const compressedSize = Math.round((base64Length * 3) / 4);
        const originalSize = file.size;

        const reduction = originalSize > 0 
          ? (((originalSize - compressedSize) / originalSize) * 100).toFixed(1)
          : '0.0';

        resolve({
          base64,
          originalSize,
          compressedSize,
          reductionPercent: `${reduction}%`,
          width,
          height,
          timestamp: new Date().toISOString()
        });
      };

      img.onerror = () => reject(new Error('Error al cargar la imagen para compresión.'));
      img.src = e.target.result;
    };

    reader.onerror = () => reject(new Error('Error al leer el archivo en memoria.'));
    reader.readAsDataURL(file);
  });
};

/**
 * Formatea bytes en formato legible (KB, MB)
 */
export const formatearBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 KB';
  const k = 1024;
  const dm = 1;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};
