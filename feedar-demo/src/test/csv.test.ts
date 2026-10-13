import { describe, expect, it } from 'vitest';
import { csvCell } from '../features/csv';

describe('audit CSV export encoding',()=>{
  it.each(['=SUM(A1:A2)','+cmd','-2+3','@SUM(A1:A2)','  =HYPERLINK("https://invalid.example")','\t=1+1','\r=1+1','\n  +cmd'])('neutralizes formula-triggering cell %j',value=>{
    expect(csvCell(value)).toBe(`"'${value.replaceAll('"','""')}"`);
  });
  it('quotes commas, double quotes and embedded newlines without splitting records',()=>{
    expect(csvCell('Local, "demo"\nmessage')).toBe('"Local, ""demo""\nmessage"');
  });
  it('preserves ordinary values and exports null as an empty quoted cell',()=>{
    expect(csvCell('robot-7')).toBe('"robot-7"');
    expect(csvCell(87)).toBe('"87"');
    expect(csvCell(null)).toBe('""');
  });
});
