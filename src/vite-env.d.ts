/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_BASE_URL: string;
    // add more VITE_ variables here as needed
  }
  
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

// Some editors/project setups may not pick up Vite's built-in asset typings.
// Declaring these keeps `import foo from './bar.png'` working in TypeScript.
declare module "*.png" {
  const src: string;
  export default src;
}
  