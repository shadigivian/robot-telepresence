export const dialingCountries = [
  {code:'IR',label:'Iran (+98)',dial:'98'},
  {code:'TR',label:'Türkiye (+90)',dial:'90'},
  {code:'AE',label:'UAE (+971)',dial:'971'},
  {code:'US',label:'US/Canada (+1)',dial:'1'},
  {code:'GB',label:'UK (+44)',dial:'44'},
  {code:'DE',label:'Germany (+49)',dial:'49'},
] as const;
export type DialingCountry = typeof dialingCountries[number]['code'];
export function countryForPhone(value:string):DialingCountry|undefined {return [...dialingCountries].sort((a,b)=>b.dial.length-a.dial.length).find(c=>value.startsWith('+'+c.dial))?.code;}
export function normalizePhone(country:DialingCountry, input:string):string {
  const entry=dialingCountries.find(c=>c.code===country);
  if(!entry||typeof input!=='string')throw new Error('Choose a supported country and phone number.');
  const raw=input.trim();if(!raw||!/^[+\d\s().-]+$/.test(raw))throw new Error('Enter a valid organization phone number.');
  let digits=raw.replace(/\D/g,'');
  if(raw.startsWith('+')){if(!digits.startsWith(entry.dial))throw new Error('Phone country code does not match the selection.');digits=digits.slice(entry.dial.length);}
  else if(digits.startsWith('00'+entry.dial))digits=digits.slice(entry.dial.length+2);
  else if(digits.startsWith(entry.dial)&&digits.length>11)digits=digits.slice(entry.dial.length);
  if(digits.startsWith('0'))digits=digits.slice(1);
  const valid:Record<DialingCountry,RegExp>={IR:/^9\d{9}$/,TR:/^[2-9]\d{9}$/,AE:/^[2-9]\d{7,8}$/,US:/^[2-9]\d{2}[2-9]\d{6}$/,GB:/^[1-9]\d{9}$/,DE:/^[1-9]\d{6,13}$/};
  if(!valid[country].test(digits))throw new Error(`Enter a valid ${entry.label} phone number.`);
  const normalized='+'+entry.dial+digits;
  if(normalized.length>16)throw new Error('Phone number exceeds E.164 length.');
  return normalized;
}
