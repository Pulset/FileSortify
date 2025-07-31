# Project Structure

## Root Directory Layout

```
FileSortify/
├── src/                    # React frontend source
├── src-tauri/             # Rust backend source
├── src-backup/            # Legacy HTML/JS implementation
├── dist/                  # Built frontend assets
├── node_modules/          # Node.js dependencies
├── scripts/               # Build and setup scripts
└── [config files]         # Package.json, tsconfig, etc.
```

## Frontend Structure (`src/`)

```
src/
├── components/            # React components
│   ├── Dashboard.tsx      # Main dashboard view
│   ├── LogsView.tsx       # Activity logs display
│   ├── OrganizeView.tsx   # File organization controls
│   ├── RulesView.tsx      # Rule management interface
│   ├── Sidebar.tsx        # Navigation sidebar
│   └── SubscriptionView.tsx # Subscription management
├── contexts/              # React contexts
│   └── LoggerContext.tsx  # Global logging state
├── hooks/                 # Custom React hooks
│   ├── useConfig.ts       # Configuration management
│   └── useStats.ts        # Statistics tracking
├── styles/                # CSS stylesheets
│   └── index.css          # Global styles
├── types/                 # TypeScript type definitions
│   └── index.ts           # Shared interfaces
├── utils/                 # Utility functions
│   ├── defaultConfig.ts   # Default configuration
│   └── tauri.ts           # Tauri API wrapper
├── App.tsx                # Main React component
└── main.tsx               # React app entry point
```

## Backend Structure (`src-tauri/`)

```
src-tauri/
├── src/                   # Rust source code
│   ├── main.rs            # Main application entry
│   ├── file_organizer.rs  # Core file organization logic
│   ├── config.rs          # Configuration management
│   ├── subscription.rs    # Subscription logic
│   ├── apple_subscription.rs # Apple-specific subscription
│   ├── storekit_bridge.rs # StoreKit Rust bridge
│   ├── storekit.h         # StoreKit C header
│   └── storekit.m         # StoreKit Objective-C implementation
├── capabilities/          # Tauri security capabilities
├── gen/                   # Generated schema files
├── icons/                 # Application icons
├── target/                # Rust build artifacts
├── Cargo.toml             # Rust dependencies
├── tauri.conf.json        # Tauri configuration
└── build.rs               # Build script
```

## Key Architectural Patterns

### Frontend Patterns
- **Component Organization**: Feature-based components in `/components`
- **State Management**: React Context for global state (logging, config)
- **Custom Hooks**: Reusable logic in `/hooks` directory
- **Type Safety**: Centralized TypeScript definitions in `/types`
- **API Layer**: Abstracted Tauri calls in `/utils/tauri.ts`

### Backend Patterns
- **Command Pattern**: Tauri commands as async functions with error handling
- **State Management**: Mutex-wrapped global state in `AppState`
- **Modular Design**: Feature separation (file_organizer, subscription, config)
- **Error Handling**: Result types with descriptive error messages
- **Platform Abstraction**: Conditional compilation for platform-specific code

### File Naming Conventions
- **React Components**: PascalCase (e.g., `Dashboard.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useConfig.ts`)
- **Rust Modules**: snake_case (e.g., `file_organizer.rs`)
- **Types**: Centralized in `types/index.ts`

### Configuration Management
- **Frontend Config**: Managed via `useConfig` hook
- **Backend Config**: Rust structs with serde serialization
- **User Settings**: Stored in platform-appropriate directories via `dirs` crate
- **Build Config**: Separate files for Tauri, Vite, and TypeScript