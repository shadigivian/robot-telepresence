import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { Moon, Sun } from 'lucide-react';

type ThemeChoice = 'system' | 'light' | 'dark';
type Theme = 'light' | 'dark';
const preferenceKey = 'feedar.theme';
const ThemeContext = createContext<{choice:ThemeChoice;theme:Theme;setChoice:(choice:ThemeChoice)=>void}|null>(null);

function savedChoice():ThemeChoice {
  try {const saved=localStorage.getItem(preferenceKey);return saved==='light'||saved==='dark'?saved:'system';}
  catch {return 'system';}
}
function systemTheme():Theme {return window.matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light';}

export function ThemeProvider({children}:{children:ReactNode}) {
  const [choice,setChoice]=useState<ThemeChoice>(savedChoice);
  const [system,setSystem]=useState<Theme>(systemTheme);
  const theme=choice==='system'?system:choice;
  useEffect(()=>{const media=window.matchMedia('(prefers-color-scheme: dark)');const changed=()=>setSystem(media.matches?'dark':'light');media.addEventListener('change',changed);return()=>media.removeEventListener('change',changed);},[]);
  useLayoutEffect(()=>{document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;},[theme]);
  useEffect(()=>{try {if(choice==='system')localStorage.removeItem(preferenceKey);else localStorage.setItem(preferenceKey,choice);}catch {/* Private browsing may block preferences. */}},[choice]);
  return <ThemeContext.Provider value={{choice,theme,setChoice}}>{children}</ThemeContext.Provider>;
}
export function useTheme(){const value=useContext(ThemeContext);if(!value)throw new Error('ThemeProvider required');return value;}
export function ThemeToggle({className='icon-button'}:{className?:string}) {
  const {theme,setChoice}=useTheme();
  return <button type="button" className={className} onClick={()=>setChoice(theme==='light'?'dark':'light')} aria-label={`Switch to ${theme==='light'?'dark':'light'} mode`} title={`Switch to ${theme==='light'?'dark':'light'} mode`}>{theme==='light'?<Moon size={19}/>:<Sun size={19}/>}</button>;
}
