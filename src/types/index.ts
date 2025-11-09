/**
 * Core Type Definitions for Video Automation Studio
 * Based on AI-driven Video Automation Blueprint
 */

/**
 * Script represents the raw and normalized markdown script
 */
export type Script = {
  id: string;
  title: string;
  language: "ja";
  raw_markdown: string;
  normalized_markdown: string;
  metadata: {
    author?: string;
    createdAt: string;
    tags?: string[];
  };
};

/**
 * Section represents a segmented portion of the script
 */
export type Section = {
  id: string;
  scriptId: string;
  order: number;
  text: string;
  intents?: IntentType[];
};

/**
 * Intent types for sections
 */
export type IntentType =
  | "summary"
  | "procedure"
  | "caution"
  | "tip"
  | "example"
  | "intro"
  | "conclusion";

/**
 * Template definition for slide generation
 */
export type TemplateDef = {
  id: string;
  desc: string;
  vars: string[];
  constraints?: {
    bullets_max?: number;
    chars_per_line_max?: number;
    lines_max?: number;
  };
};

/**
 * SlideUnit represents a single slide with template and variables
 */
export type SlideUnit = {
  template: string; // TemplateDef.id
  vars: Record<string, any>;
  assets?: AssetRef[];
};

/**
 * SlideSpec groups slides for a section
 */
export type SlideSpec = {
  section_id: string;
  slides: SlideUnit[];
};

/**
 * AssetRef represents media assets used in slides
 */
export type AssetRef = {
  kind: "image" | "svg" | "audio" | "video";
  path: string;
  license?: string;
  attribution?: string;
};

/**
 * Timing information for subtitle synchronization
 */
export type Timing = {
  lineId: string;
  startSec: number;
  endSec: number;
  gapAfterSec: number;
};

/**
 * RenderJob tracks the status of video rendering
 */
export type RenderJob = {
  id: string;
  scriptId: string;
  slideSpecPath: string;
  remotionEntry: string;
  status: "queued" | "running" | "done" | "failed";
  outputs?: {
    videoPath: string;
    thumbPath: string;
  };
  error?: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * LLM Task Request structure
 */
export type LLMTaskRequest = {
  task: "normalize" | "segment" | "slidespec" | "remotion";
  script_markdown?: string;
  templates_json?: { templates: TemplateDef[] };
  sections_json?: { sections: Section[] };
  audio_catalog_json?: { bgm: AudioAsset[]; sfx: AudioAsset[] };
  script_json?: Script;
  slides_manifest_json?: { specs: SlideSpec[] };
  constraints?: {
    chars_per_line_max: number;
    lines_max: number;
    speech_density_range: [number, number];
  };
};

/**
 * Audio assets for BGM and SFX
 */
export type AudioAsset = {
  id: string;
  name: string;
  path: string;
  duration: number;
  category?: string;
  license?: string;
};

/**
 * Validation result
 */
export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
};

/**
 * Validation error
 */
export type ValidationError = {
  code: string;
  message: string;
  field?: string;
  context?: any;
};

/**
 * Validation warning
 */
export type ValidationWarning = {
  code: string;
  message: string;
  field?: string;
  context?: any;
};

/**
 * Pause rules for timing
 */
export const PAUSE_RULES = {
  CONTINUOUS: 0.1, // 連続文
  TOPIC_CHANGE: 0.35, // トピック転換/句点
  SECTION_BREAK: 0.5, // セクション区切り
} as const;

/**
 * Speech density constraints (chars per second)
 */
export const SPEECH_DENSITY = {
  MIN: 12,
  MAX: 28,
} as const;
