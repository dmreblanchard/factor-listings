import { PDFDocument } from 'pdf-lib';

export const compressPDFBlob = async (blob, options = {}) => {
  const {
    targetMB = 5,
    quality = 0.7,
    removeMetadata = true,
    downSampleImages = true
  } = options;

  try {
    // Load PDF
    const pdfDoc = await PDFDocument.load(await blob.arrayBuffer());

    // Downsample images if enabled
    if (downSampleImages) {
      const images = pdfDoc.getPages().flatMap(p => p.getImages());
      for (const image of images) {
        try {
          image.scale(quality); // Reduce image quality
        } catch (e) {
          console.warn('Could not downsample image:', e);
        }
      }
    }

    // Remove metadata if enabled
    if (removeMetadata) {
      pdfDoc.setTitle("Compressed Report");
      pdfDoc.setAuthor("");
      pdfDoc.setProducer("");
    }

    // Save with compression
    const compressedBytes = await pdfDoc.save({
      useObjectStreams: true,
      useCompression: true,
      embedPageText: true
    });

    return new Blob([compressedBytes], { type: 'application/pdf' });
  } catch (error) {
    console.error('Compression failed, returning original:', error);
    return blob; // Fallback to original
  }
};
