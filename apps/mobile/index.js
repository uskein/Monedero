/**
 * Entry point Expo (SDK 57) — registra AppRoot como componente raíz.
 * Sustituye al histórico node_modules/expo/AppEntry.js (ya no existe en SDK 57):
 * el campo "main" de package.json apunta aquí.
 */
import { registerRootComponent } from 'expo';
import AppRoot from './src/AppRoot';

registerRootComponent(AppRoot);
