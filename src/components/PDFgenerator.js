import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import DMSansRegular from "../assets/DMSans-Regular.js";
import DMSansBold from "../assets/DMSans-Bold.js";
import { generateMapImageFromGeoData } from './generateMap';

const loadImage = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = url;
  });
};

const calculateMapDimensions = (pageWidth, pageHeight, margins) => {
  const MAX_WIDTH = 1280;
  const MAX_HEIGHT = 1280;
  const availableWidth = Math.floor(pageWidth - margins.left - margins.right);
  const availableHeight = Math.floor(pageHeight - margins.top - margins.bottom - 50);
  const width = Math.min(availableWidth, MAX_WIDTH);
  const height = Math.min(availableHeight, MAX_HEIGHT);
  return {
    width: width % 2 === 0 ? width : width - 1,
    height: height % 2 === 0 ? height : height - 1
  };
};

const registerFonts = (doc) => {
  doc.addFileToVFS("DMSans-Regular.ttf", DMSansRegular);
  doc.addFont("DMSans-Regular.ttf", "DMSans", "normal");
  doc.addFileToVFS("DMSans-Bold.ttf", DMSansBold);
  doc.addFont("DMSans-Bold.ttf", "DMSans", "bold");
  doc.setFont("DMSans", "normal");
};

const createHeader = (doc, reportTitle, rows, headerImg, pageWidth, styles, margins) => {
  const headerHeight = pageWidth * (0.63 / 11);
  if (headerImg) doc.addImage(headerImg, 'PNG', 0, 0, pageWidth, headerHeight);

  doc.setFont(styles.titleFont, styles.titleFontWeight);
  doc.setFontSize(styles.titleSize);
  doc.setTextColor(255, 255, 255);
  const titleY = headerHeight / 2 + styles.titleSize / 2 - 2;
  doc.text(reportTitle, margins.left, titleY);

  doc.setFont(styles.subtitleFont, styles.subtitleFontWeight);
  doc.setFontSize(styles.subtitleSize);
  doc.text(`Generated: ${new Date().toLocaleString()} | ${rows.length} Properties`,
           margins.left, titleY + styles.subtitleSize + 4);
};

export const generatePDFReport = async (rows, columns, reportTitle, options = {}, geoData = {}) => {
  // Create tabular report
  const tabularDoc = new jsPDF({
    orientation: options.orientation || 'landscape',
    unit: 'pt',
    format: 'a4'
  });

  registerFonts(tabularDoc);

  const pageWidth = tabularDoc.internal.pageSize.width;
  const pageHeight = tabularDoc.internal.pageSize.height;
  const margins = { top: 80, left: 18, right: 18, bottom: 40 };

  const styles = {
    titleFont: "DMSans",
    titleFontWeight: "bold",
    titleSize: 18,
    subtitleFont: "DMSans",
    subtitleFontWeight: "normal",
    subtitleSize: 10,
    tableFont: "DMSans",
    tableFontWeight: "normal",
    tableFontSize: 8,
    headerFontWeight: "bold",
    headerColor: [22, 54, 92],
    alternateRowColor: [245, 245, 245],
    watermark: {
      text: "CONFIDENTIAL\nThis information has been derived from sources deemed reliable...",
      opacity: 0.1,
      angle: -45,
      fontSize: 48,
      color: [200, 200, 200]
    },
    footer: {
      text: "CONFIDENTIAL: This information has been derived from sources deemed reliable. However, it is subject to errors, omissions, price change and/or withdrawal, and no warranty is made as to the accuracy. Further, no warranties or representations shall be made by DMRE and/or its agents, representatives or affiliates regarding oral statements which have been made in the discussion of the above properties.",
      fontSize: 7,
      lineHeight: 1.2,
      color: [100, 100, 100],
      marginBottom: 25, // Optimal spacing from bottom
      width: pageWidth - margins.left - margins.right - 40
    }
  };

  // Load images once (shared between docs)
  const [headerImg, logoImg] = await Promise.all([
    loadImage(`${window.location.origin}/dmre_header_graphic.png`).catch(() => null),
    loadImage(`${window.location.origin}/Logomark_blue.png`).catch(() => null)
  ]);

  // Add header to tabular report
  createHeader(tabularDoc, reportTitle, rows, headerImg, pageWidth, styles, margins);

  // Configure table columns
  const visibleColumns = [{ headerName: '', field: 'rowNumber' }, ...columns.filter(col => col.field !== 'actions')];
  const headers = visibleColumns.map(col => col.headerName);

  // Calculate column widths
  const usableTableWidth = pageWidth - margins.left - margins.right;

  // Calculate maximum row number width
  const maxRowNumber = rows.length;
  const rowNumberWidth = Math.max(
    tabularDoc.getStringUnitWidth(maxRowNumber.toString()) * styles.tableFontSize * 0.6,
    20
  ) + 10;

  const dmreColumnIndex = visibleColumns.findIndex(col => col.field === 'isDMRE');
  const dmreColumnWidth = dmreColumnIndex >= 0 ? 40 : 0;

  // Calculate remaining width for other columns
  const remainingWidth = usableTableWidth - rowNumberWidth - dmreColumnWidth;
  const regularColumnsCount = visibleColumns.length -
                            (dmreColumnIndex >= 0 ? 1 : 0) -
                            1;

  const defaultColumnWidth = Math.floor(remainingWidth / regularColumnsCount);

  // Apply column styles
  const columnStyles = {};
  visibleColumns.forEach((col, idx) => {
    if (col.field === 'rowNumber') {
      columnStyles[idx] = {
        cellWidth: rowNumberWidth,
        minCellWidth: 20,
        halign: 'center'
      };
    } else if (col.field === 'isDMRE') {
      columnStyles[idx] = {
        cellWidth: dmreColumnWidth,
        minCellWidth: 40
      };
    } else {
      columnStyles[idx] = {
        cellWidth: defaultColumnWidth,
        minCellWidth: 40
      };
    }
  });

  // Generate table body
  const body = rows.map((row, index) => visibleColumns.map(col => {
    if (col.field === 'rowNumber') return index + 1;
    if (col.field === 'isDMRE' && row[col.field] === true) return { content: '', isDMRE: true };
    // Special handling for masked close dates
    if (col.field === 'closeDate' && row[col.field] === '-') {
      return {
        content: '-',
        styles: {
          fontStyle: 'bold',
          textColor: [150, 150, 150] // Gray color for masked values
        }
      };
    }
    if (col.valueFormatter) {
      // For closeDate, skip formatting if it's already masked
      if (col.field === 'closeDate' && row[col.field] === '-') {
        return '-';
      }
      return col.valueFormatter({ value: row[col.field] });
    }
    return row[col.field] || '';
  }));

  // Add table to tabular report
  autoTable(tabularDoc, {
    startY: 80,
    margin: margins,
    head: [headers],
    body,
    columnStyles,
    styles: {
      font: styles.tableFont,
      fontStyle: styles.tableFontWeight,
      fontSize: styles.tableFontSize,
      cellPadding: 4,
      lineColor: [200, 200, 200],
      lineWidth: 0.5,
      textColor: [50, 50, 50],
      overflow: 'linebreak'
    },
    headStyles: {
      font: styles.tableFont,
      fontStyle: styles.headerFontWeight,
      fontSize: styles.tableFontSize + 1,
      fillColor: styles.headerColor,
      textColor: 255,
      halign: 'center'
    },
    alternateRowStyles: {
      fillColor: styles.alternateRowColor
    },
    didDrawCell: (data) => {
      if (dmreColumnIndex >= 0 && data.column.index === dmreColumnIndex && data.cell.raw?.isDMRE && logoImg) {
        const targetWidth = 16;
        const targetHeight = targetWidth * (1.52 / 1.3);
        const xPos = data.cell.x + (data.cell.width - targetWidth) / 2;
        const yPos = data.cell.y + (data.cell.height - targetHeight) / 2;
        tabularDoc.addImage(logoImg, 'PNG', xPos, yPos, targetWidth, targetHeight);
      }
    },
    didDrawPage: (data) => {
      createHeader(tabularDoc, reportTitle, rows, headerImg, pageWidth, styles, margins);

      // Original footer positioning logic
      const footerY = pageHeight - margins.bottom + 5;
      const footerWidth = pageWidth * 0.8;
      const footerText = "CONFIDENTIAL: This information has been derived from sources deemed reliable. However, it is subject to errors, omissions, price change and/or withdrawal, and no warranty is made as to the accuracy. Further, no warranties or representations shall be made by DMRE and/or its agents, representatives or affiliates regarding oral statements which have been made in the discussion of the above properties.";

      const wrappedFooterText = tabularDoc.splitTextToSize(footerText, footerWidth);

      tabularDoc.setFont(styles.tableFont, "normal");
      tabularDoc.setFontSize(styles.tableFontSize);
      tabularDoc.setTextColor(100, 100, 100);
      tabularDoc.text(wrappedFooterText, margins.left, footerY);

      // Original watermark placement (only on first page)
      if (data.pageNumber === 1) {
        tabularDoc.setFont(styles.tableFont, 'normal');
        tabularDoc.setFontSize(styles.watermark.fontSize);
        tabularDoc.setTextColor(200, 200, 200);
        tabularDoc.setGState(tabularDoc.GState({ opacity: styles.watermark.opacity }));
        tabularDoc.text(
          styles.watermark.text,
          pageWidth / 2,
          pageHeight / 2,
          {
            angle: styles.watermark.angle,
            align: 'center',
            lineHeightFactor: 1.5
          }
        );
        tabularDoc.setGState(tabularDoc.GState({ opacity: 1 }));
      }
    }
  });

  // Add final page numbers to tabular report
  const totalPages = tabularDoc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    tabularDoc.setPage(i);
    tabularDoc.setFont(styles.tableFont, 'normal');
    tabularDoc.setFontSize(styles.tableFontSize);
    tabularDoc.setTextColor(100, 100, 100);
    tabularDoc.text(`Page ${i} of ${totalPages}`, pageWidth - margins.right - 60, pageHeight - margins.bottom + 10);
  }

  // Generate map PDF separately if geoData exists
  let mapDoc = null;
  if (Object.keys(geoData).length > 0) {
    mapDoc = new jsPDF({
      orientation: options.orientation || 'landscape',
      unit: 'pt',
      format: 'a4'
    });

    registerFonts(mapDoc);

    // Add header to map document
    createHeader(mapDoc, `${reportTitle} - Map`, rows, headerImg, pageWidth, styles, margins);

    // Calculate map dimensions
    const { width: mapWidth, height: mapHeight } = calculateMapDimensions(pageWidth, pageHeight, margins);

    try {
      const mapDataUrl = await generateMapImageFromGeoData(geoData, {
        width: mapWidth,
        height: mapHeight
      });

      if (mapDataUrl) {
        const xPos = (pageWidth - mapWidth) / 2;
        mapDoc.addImage(mapDataUrl, 'PNG', xPos, margins.top + 30, mapWidth, mapHeight);
        mapDoc.setFont(styles.tableFont, 'normal');
        mapDoc.setFontSize(styles.tableFontSize - 1);
        mapDoc.text('Numbered markers correspond to properties in the table report',
                   margins.left, pageHeight - margins.bottom);
      }
    } catch (error) {
      console.error('Map generation error:', error);
      mapDoc.setFont(styles.tableFont, 'normal');
      mapDoc.setFontSize(styles.tableFontSize);
      mapDoc.text('Map could not be loaded', margins.left, margins.top + 50);
      mapDoc.text(error.message.substring(0, 100), margins.left, margins.top + 70);
    }

    // Add page number to map
    mapDoc.setFont(styles.tableFont, 'normal');
    mapDoc.setFontSize(styles.tableFontSize);
    mapDoc.setTextColor(100, 100, 100);
  }

  // Return both documents in optimal formats
  return {
    tabularPDF: tabularDoc.output('arraybuffer'), // Best for Lambda/S3 upload
    mapPDF: mapDoc ? mapDoc.output('blob') : null // Best for direct download
  };
};
