/**
 * Validation Functions
 * Ensures data integrity and compliance with constraints
 */

import {
  SlideUnit,
  TemplateDef,
  Section,
  Timing,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  SPEECH_DENSITY,
} from "../types";

/**
 * Validate a single slide unit against its template
 */
export function validateSlideUnit(
  unit: SlideUnit,
  template: TemplateDef
): string[] {
  const errors: string[] = [];

  // Check all required vars are present
  for (const varName of template.vars) {
    if (unit.vars[varName] === undefined) {
      errors.push(`missing var: ${varName}`);
    }
  }

  // Check constraints
  if (template.constraints) {
    const { bullets_max, chars_per_line_max, lines_max } =
      template.constraints;

    // Validate bullets
    if (bullets_max && Array.isArray(unit.vars.bullets)) {
      if (unit.vars.bullets.length > bullets_max) {
        errors.push(
          `too many bullets: ${unit.vars.bullets.length} > ${bullets_max}`
        );
      }

      // Check each bullet line length
      if (chars_per_line_max) {
        unit.vars.bullets.forEach((bullet: string, idx: number) => {
          if (bullet.length > chars_per_line_max) {
            errors.push(
              `bullet[${idx}] too long: ${bullet.length} > ${chars_per_line_max}`
            );
          }
        });
      }
    }

    // Validate line length for text vars
    if (chars_per_line_max) {
      Object.entries(unit.vars).forEach(([key, value]) => {
        if (typeof value === "string" && key !== "code") {
          const lines = value.split("\n");
          lines.forEach((line, idx) => {
            if (line.length > chars_per_line_max) {
              errors.push(
                `${key}[line ${idx}] too long: ${line.length} > ${chars_per_line_max}`
              );
            }
          });
        }
      });
    }

    // Validate total lines
    if (lines_max) {
      const totalLines = Object.entries(unit.vars).reduce(
        (count, [key, value]) => {
          if (typeof value === "string" && key !== "code") {
            return count + value.split("\n").length;
          }
          if (Array.isArray(value)) {
            return count + value.length;
          }
          return count;
        },
        0
      );

      if (totalLines > lines_max) {
        errors.push(`too many lines: ${totalLines} > ${lines_max}`);
      }
    }
  }

  // Validate assets
  if (unit.assets) {
    unit.assets.forEach((asset, idx) => {
      if (!asset.path || asset.path === "missing://") {
        errors.push(`asset[${idx}] has missing path`);
      }
    });
  }

  return errors;
}

/**
 * Validate all slides in a spec
 */
export function validateSlideSpec(
  slides: SlideUnit[],
  templates: TemplateDef[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  const templateMap = new Map(templates.map((t) => [t.id, t]));

  slides.forEach((slide, idx) => {
    const template = templateMap.get(slide.template);

    if (!template) {
      errors.push({
        code: "UNKNOWN_TEMPLATE",
        message: `Unknown template: ${slide.template}`,
        field: `slides[${idx}].template`,
        context: { slideIndex: idx, templateId: slide.template },
      });
      return;
    }

    const slideErrors = validateSlideUnit(slide, template);
    slideErrors.forEach((err) => {
      errors.push({
        code: "SLIDE_VALIDATION_ERROR",
        message: err,
        field: `slides[${idx}]`,
        context: { slideIndex: idx, templateId: slide.template },
      });
    });
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate section length and intent tags
 */
export function validateSection(section: Section): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Check text length (300-600 chars recommended)
  if (section.text.length < 300) {
    warnings.push({
      code: "SECTION_TOO_SHORT",
      message: `Section text is shorter than recommended: ${section.text.length} < 300`,
      field: "text",
      context: { sectionId: section.id, length: section.text.length },
    });
  }

  if (section.text.length > 600) {
    warnings.push({
      code: "SECTION_TOO_LONG",
      message: `Section text is longer than recommended: ${section.text.length} > 600`,
      field: "text",
      context: { sectionId: section.id, length: section.text.length },
    });
  }

  // Validate intents
  const validIntents = [
    "summary",
    "procedure",
    "caution",
    "tip",
    "example",
    "intro",
    "conclusion",
  ];

  if (section.intents) {
    section.intents.forEach((intent) => {
      if (!validIntents.includes(intent)) {
        warnings.push({
          code: "INVALID_INTENT",
          message: `Unknown intent type: ${intent}`,
          field: "intents",
          context: { sectionId: section.id, intent },
        });
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate speech density (chars per second)
 */
export function validateSpeechDensity(
  timings: Timing[],
  textMap: Map<string, string>
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  timings.forEach((timing) => {
    const text = textMap.get(timing.lineId);
    if (!text) {
      warnings.push({
        code: "MISSING_TEXT",
        message: `No text found for lineId: ${timing.lineId}`,
        field: "lineId",
        context: { lineId: timing.lineId },
      });
      return;
    }

    const duration = timing.endSec - timing.startSec;
    if (duration <= 0) {
      errors.push({
        code: "INVALID_DURATION",
        message: `Invalid duration for lineId ${timing.lineId}: ${duration}`,
        field: "duration",
        context: { lineId: timing.lineId, duration },
      });
      return;
    }

    const charsPerSec = text.length / duration;

    if (charsPerSec < SPEECH_DENSITY.MIN) {
      warnings.push({
        code: "SPEECH_TOO_SLOW",
        message: `Speech density too low: ${charsPerSec.toFixed(
          2
        )} < ${SPEECH_DENSITY.MIN}`,
        field: "timing",
        context: {
          lineId: timing.lineId,
          charsPerSec: charsPerSec.toFixed(2),
        },
      });
    }

    if (charsPerSec > SPEECH_DENSITY.MAX) {
      warnings.push({
        code: "SPEECH_TOO_FAST",
        message: `Speech density too high: ${charsPerSec.toFixed(
          2
        )} > ${SPEECH_DENSITY.MAX}`,
        field: "timing",
        context: {
          lineId: timing.lineId,
          charsPerSec: charsPerSec.toFixed(2),
        },
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate timing synchronization
 */
export function validateTimingSync(timings: Timing[]): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  for (let i = 0; i < timings.length - 1; i++) {
    const current = timings[i];
    const next = timings[i + 1];

    // Check for timing overlap
    const currentEnd = current.endSec + current.gapAfterSec;
    if (currentEnd > next.startSec) {
      errors.push({
        code: "TIMING_OVERLAP",
        message: `Timing overlap detected between ${current.lineId} and ${next.lineId}`,
        field: "timings",
        context: {
          currentId: current.lineId,
          nextId: next.lineId,
          currentEnd,
          nextStart: next.startSec,
        },
      });
    }

    // Check for large gaps (> 1 second)
    const gap = next.startSec - currentEnd;
    if (gap > 1.0) {
      warnings.push({
        code: "LARGE_GAP",
        message: `Large gap detected: ${gap.toFixed(2)}s between ${
          current.lineId
        } and ${next.lineId}`,
        field: "timings",
        context: {
          currentId: current.lineId,
          nextId: next.lineId,
          gap: gap.toFixed(2),
        },
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
