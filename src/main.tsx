import {createRoot} from 'react-dom/client';
import LauncherApp from './launcher/App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<LauncherApp />);
