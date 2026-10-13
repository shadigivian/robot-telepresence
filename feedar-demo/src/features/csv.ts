/** Encode one CSV cell and neutralize spreadsheet formulas in exported demo text. */
export function csvCell(value:unknown):string {
  let text=String(value??'');
  if(/^\s*[=+\-@\t\r]/.test(text))text=`'${text}`;
  return `"${text.replaceAll('"','""')}"`;
}
