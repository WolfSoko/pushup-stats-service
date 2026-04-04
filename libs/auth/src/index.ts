/// <reference types="@angular/localize" />

// Guards
export * from './lib/core/auth.guard';
export * from './lib/core/admin.guard';

// Core services
export * from './lib/core/auth.service';
export * from './lib/core/user-context.service';

// Auth provider setup
export * from './lib/provide-auth';

// UI components
export * from './lib/ui/login/login.component';
export * from './lib/ui/register/register.component';
export * from './lib/ui/user-menu/user-menu.component';

// Public types
export type { User } from './lib/core/model/user.type';

// State (public store only)
export { AuthStore } from './lib/core/state/auth.store';

// Ports & adapters (for app-level wiring)
export * from './lib/core/ports/post-auth.hook';
export * from './lib/core/ports/user-profile.port';
