/**
 * Copilot Ontology Module
 * Central export for all ontology types and utilities
 */

// Core schema and types (includes selective re-exports from other modules)
export * from './schema';

// Mode definitions
export * from './modes';

// Context types
export * from './context';

// Behavioral rules and prompts
export * from './behaviors';

// Note: outputs.ts and learning.ts are selectively re-exported from schema.ts
// to avoid duplicate export conflicts (e.g., QuizQuestion exists in both)
