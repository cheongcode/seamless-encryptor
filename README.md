## Seamless Encryptor

Simple, local-first file encryption desktop app built with Electron. Uses AES-256-GCM and stores encrypted files in the app's user data directory. A persistent 32-byte master key is stored at runtime in memory and on disk under your user data path.

## Quick start

```bash
git clone <this repo>
cd seamless-encryptor
npm ci
npm start
```

- Development starts an Electron window and a dev server for the renderer.
- Production bundles can be built with:

```bash
npm run build          # compile main/preload/renderer bundles
npm run package        # create OS-specific distributables
```

## How to use

1. Launch the app. A 32-byte master key is generated and persisted automatically on first run.
2. Drag-and-drop a file into the drop zone or click Select File.
3. The file is encrypted with AES-256-GCM and saved to local storage. The UI lists your encrypted files.
4. Use Download to decrypt and save a plaintext copy, or Download Encrypted to export the encrypted blob.
5. Delete removes the encrypted file from local storage (does not touch your original source file).

## Where things live

- Main process: `src/main/main.js`
  - Creates the `BrowserWindow`, sets CSP, wires IPC handlers for encrypt/decrypt/download/delete, and manages temporary files.
- Preload: `src/preload/preload.js`
  - Bridges safe, explicit APIs into `window.api` for the renderer.
- Renderer UI: `src/renderer/index.html`, `src/renderer/renderer.js`
  - Basic UI, drag-and-drop, progress + notifications, calls `window.api` methods.
- Key management: `src/config/keyManager.js`
  - Generates, persists, and returns the 32-byte master key.

## IPC / Renderer API (exposed via preload as `window.api`)

- `encryptFile(filePath: string): Promise<{ success: boolean; fileId?: string; fileName?: string; error?: string }>`
- `decryptFile(encryptedData: Buffer): Promise<Buffer | { success: false; error: string }>`
- `downloadFile(fileId: string, fileName: string): Promise<{ success: boolean; error?: string }>`
- `downloadEncryptedFile(fileId: string, fileName: string): Promise<{ success: boolean; error?: string }>`
- `deleteFile(fileId: string): Promise<{ success: boolean; error?: string }>`
- `saveDroppedFile(fileObject: { name: string; type: string; size: number; data: number[] }): Promise<string>`
- `generateKey(): Promise<string /* hex */>`
- `getKey(): Promise<string | null /* hex */>`
- `setKey(keyHex: string): Promise<true>`
- `openFileDialog(): Promise<string | null>`
- `saveFileDialog(): Promise<string | null>`
- `onProgress((percent: number) => void): () => void`
- `onDownloadProgress((data: { progress: number; status: string }) => void): () => void`
- `onError((message: string) => void): () => void`
- `onSuccess((message: string) => void): () => void`

## Encryption details

- Algorithm: AES-256-GCM (Node `crypto` module).
- Key: 32 bytes (256-bit). Persisted at `app.getPath('userData')/keys/master.key`.
- Nonce/IV: 16 bytes (random per encryption).
- Auth tag: 16 bytes (GCM default).
- Payload layout for encrypted files: `[IV(16)] [TAG(16)] [CIPHERTEXT]`.

## Storage locations

- Encrypted files: `app.getPath('userData')/encrypted/<fileId>/<fileName>.enc`
- Master key: `app.getPath('userData')/keys/master.key`
- Temporary dropped-file cache: `app.getPath('temp')/seamless-encryptor/`

## Security choices

- `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true` in the BrowserWindow.
- Preload script exposes only a minimal, explicit `window.api` surface.
- CSP is set at runtime; development mode relaxes it for hot reload.

## Troubleshooting

- Port in use (listen EADDRINUSE :::9000)
  - The webpack logger server is on port 9000 by default. Either close the process using it:
    ```bash
    lsof -i :9000 | awk 'NR>1 {print $2}' | xargs -r kill -9
    ```
    or change `loggerPort` in `forge.config.js` under the webpack plugin config. Similarly, you can change the dev `port` there if 3000 conflicts.

- Renderer assets 404 or MIME type errors
  - The renderer bundle is served at the dev server root. The app references `/renderer.js` and webpack `publicPath` is `/`. If you customize the dev server, keep paths aligned.

## Scripts

- `npm start` – run Electron Forge with webpack plugin for development.
- `npm run build` – compile all bundles for production.
- `npm run package` – package the app for your platform.
- `npm run make` – create distributables (DMG/ZIP/DEB/RPM depending on OS).


