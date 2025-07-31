# Technology Stack

## Architecture
- **Framework**: Tauri 2.0 - Rust backend with web frontend
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Rust with async/await patterns using Tokio
- **Build System**: Vite for frontend, Cargo for Rust backend

## Key Dependencies

### Frontend
- React 18.2.0 with React DOM
- TypeScript 5.2.2 for type safety
- Vite 5.0.8 for development and bundling
- @tauri-apps/api 2.7.0 for Tauri integration

### Backend (Rust)
- tauri 2.0 with tray-icon feature
- tokio for async runtime
- serde/serde_json for serialization
- notify 6.0 for file system monitoring
- walkdir 2.3 for directory traversal
- dirs 5.0 for system directory access
- chrono for date/time handling
- reqwest for HTTP requests (subscription verification)

### Platform-Specific
- **macOS**: StoreKit integration via Objective-C bridge
- **Windows**: winapi for system integration
- **Cross-platform**: Tauri plugins for notifications, dialogs, file system

## Development Commands

```bash
# Development
npm run dev              # Start Vite dev server
npm run tauri:dev        # Start Tauri development mode

# Building
npm run build            # Build frontend only
npm run tauri:build      # Build complete Tauri app

# Platform-specific builds
npm run build-mac        # Intel Mac
npm run build-mac-arm    # Apple Silicon Mac
npm run build-windows    # Windows x64
npm run build-linux      # Linux x64

# Testing & Linting
npm run test             # Run tests
npm run lint             # ESLint check
npm run lintfix          # Auto-fix linting issues

# Subscription setup
npm run setup-apple      # Configure Apple subscription
npm run test-subscription # Test subscription features
```

## Configuration Files
- `tauri.conf.json` - Tauri app configuration
- `vite.config.ts` - Vite bundler configuration  
- `tsconfig.json` - TypeScript compiler options
- `Cargo.toml` - Rust dependencies and metadata

## Development Server
- Frontend runs on `http://localhost:1420` (fixed port)
- Hot reload enabled for frontend changes
- Rust backend rebuilds automatically in dev mode