/**
 * Video Automation Studio - Main Entry Point
 * Export all public APIs
 */

// Types
export * from "./types";

// Services
export * from "./services/scriptService";
export * from "./services/slideService";

// Prompts
export * from "./prompts";

// Validators
export * from "./validators";

// Utils
export * from "./utils/logger";

// API Server
export { default as app, startServer } from "./api/server";
