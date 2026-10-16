import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { DemoProvider } from './app/context';
import { App } from './app/App';
import {demoAvailable} from './app/runtime';
import './styles/global.css';
import './styles/management.css';
import './styles/operational-login.css';

createRoot(document.getElementById('root')!).render(<HashRouter>{demoAvailable?<DemoProvider><App/></DemoProvider>:<App/>}</HashRouter>);
