// TSPL2 label for TSC printers: 69.5 x 15 mm web, 203 dpi (8 dots/mm), two copies side by side.
// Everything is drawn at rotation 180, so an x coordinate is the object's RIGHT edge.

const COPY_CENTRE = 421; // centre of the right-hand copy, in dots
const COPY_OFFSET = 296; // left-hand copy sits this far back
const NARROW = 1; // narrow bar width in dots
const CHAR_W = 10; // width of one character of font "0" at xmul 7

interface LabelRow {
  digits: string;
  barcodeY: number;
  textY: number;
}

/**
 * Encodes digits for TSPL code type "128M" (Code 128, manual subset control),
 * where "!" followed by a 3-digit code value emits a control symbol:
 * 105 starts subset C, 100 switches to subset B.
 * Subset C packs two digits per symbol, so an odd trailing digit moves to subset B.
 */
function encode128M(digits: string): string {
  return digits.length % 2 === 0
    ? `!105${digits}`
    : `!105${digits.slice(0, -1)}!100${digits.slice(-1)}`;
}

/** Printed width in dots: 11 modules per symbol, plus the 13-module stop pattern. */
function barcodeWidth(digits: string): number {
  const symbols = Math.floor(digits.length / 2) + (digits.length % 2 ? 2 : 0);
  return NARROW * (11 * (symbols + 2) + 13);
}

function drawRow(row: LabelRow, centre: number): string[] {
  const barcodeX = centre + Math.ceil(barcodeWidth(row.digits) / 2);
  const textX = centre + Math.ceil((row.digits.length * CHAR_W) / 2);
  return [
    `BARCODE ${barcodeX},${row.barcodeY},"128M",20,0,180,1,2,"${encode128M(row.digits)}"`,
    `TEXT ${textX},${row.textY},"0",180,7,8,"${row.digits}"`,
  ];
}

/**
 * Builds the TSPL print job for one SIM label: ICCID on the top row, SIM phone below.
 * The <xpml> tags are the TSC driver's spooler page markers and must be kept.
 */
export function buildSimLabelPrn(iccid: string, simPhone: string, copies = 1): string {
  const rows: LabelRow[] = [
    { digits: iccid.replace(/\D/g, ''), barcodeY: 64, textY: 38 },
    { digits: simPhone.replace(/\D/g, ''), barcodeY: 117, textY: 91 },
  ].filter((row) => row.digits.length > 0);

  const body = [
    ...rows.flatMap((row) => drawRow(row, COPY_CENTRE)),
    ...rows.flatMap((row) => drawRow(row, COPY_CENTRE - COPY_OFFSET)),
  ];

  const lines = [
    `<xpml><page quantity='0' pitch='15.0 mm'></xpml>SIZE 69.5 mm, 15 mm`,
    'SPEED 3',
    'DENSITY 11',
    'DIRECTION 0,0',
    'REFERENCE 0,0',
    'OFFSET 0 mm',
    'SET PEEL OFF',
    'SET CUTTER OFF',
    'SET PARTIAL_CUTTER OFF',
    `<xpml></page></xpml><xpml><page quantity='${copies}' pitch='15.0 mm'></xpml>SET TEAR ON`,
    'CLS',
    body[0],
    'CODEPAGE 1252',
    ...body.slice(1),
    `PRINT 1,${copies}`,
  ];

  return `${lines.join('\r\n')}\r\n<xpml></page></xpml><xpml><end/></xpml>`;
}

export function downloadSimLabelPrn(iccid: string, simPhone: string, copies = 1): void {
  const blob = new Blob([buildSimLabelPrn(iccid, simPhone, copies)], {
    type: 'application/octet-stream',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${iccid || simPhone}.prn`;
  anchor.click();
  URL.revokeObjectURL(url);
}
