/**
 * Slide Service
 * Handles slide planning, rendering, and asset management
 */

import { Section, SlideSpec, TemplateDef, SlideUnit } from "../types";
import { buildLLMRequest, parseLLMResponse } from "../prompts";
import { validateSlideSpec } from "../validators";
import { LLMClient, getDefaultLLMClient } from "./llmService";
import { StorageService, getDefaultStorage } from "./storageService";
import { logger } from "../utils/logger";
import * as fs from "fs/promises";
import * as path from "path";

/**
 * Load templates from file
 */
export async function loadTemplates(
  templatePath?: string
): Promise<TemplateDef[]> {
  const defaultPath = path.join(
    __dirname,
    "../../templates/default-templates.json"
  );
  const filePath = templatePath || defaultPath;

  try {
    const content = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(content);
    return data.templates;
  } catch (error) {
    throw new Error(`Failed to load templates: ${error}`);
  }
}

/**
 * Slide Service Class
 */
export class SlideService {
  private llmClient: LLMClient;
  private storage: StorageService;

  constructor(llmClient?: LLMClient, storage?: StorageService) {
    this.llmClient = llmClient || getDefaultLLMClient();
    this.storage = storage || getDefaultStorage();
  }

  /**
   * Generate slide specifications from sections using LLM
   */
  async planSlides(
    scriptId: string,
    sections: Section[],
    templates: TemplateDef[]
  ): Promise<SlideSpec[]> {
    logger.info("Planning slides", { scriptId, sectionCount: sections.length });

    const prompt = buildLLMRequest({
      task: "slidespec",
      sections_json: { sections },
      templates_json: { templates },
    });

    const response = await this.llmClient.complete(prompt);
    const result = parseLLMResponse("slidespec", response);

    // Validate the generated specs
    const allSlides = result.specs.flatMap((spec: SlideSpec) => spec.slides);
    const validation = validateSlideSpec(allSlides, templates);

    if (!validation.valid) {
      logger.warn("Slide validation errors", { errors: validation.errors });
      logger.warn("Slide validation warnings", { warnings: validation.warnings });
    }

    await this.storage.saveSlideSpecs(scriptId, result.specs);
    logger.info("Slides planned", { scriptId, specCount: result.specs.length });

    return result.specs;
  }

  /**
   * Load slide specs for a script
   */
  async loadSlideSpecs(scriptId: string): Promise<SlideSpec[] | null> {
    return await this.storage.loadSlideSpecs(scriptId);
  }
}

/**
 * Default slide service instance
 */
let defaultSlideService: SlideService | null = null;

export function getDefaultSlideService(): SlideService {
  if (!defaultSlideService) {
    defaultSlideService = new SlideService();
  }
  return defaultSlideService;
}

/**
 * Reset default slide service (useful for testing)
 */
export function resetDefaultSlideService(): void {
  defaultSlideService = null;
}

/**
 * Legacy function exports (for backward compatibility)
 */
export async function planSlides(
  sections: Section[],
  templates: TemplateDef[],
  _llmClient?: (prompt: string) => Promise<string>
): Promise<SlideSpec[]> {
  // This function requires scriptId, but we'll use a temporary approach
  // In practice, this should be called with a scriptId
  const service = getDefaultSlideService();
  const scriptId = sections[0]?.scriptId || "temp";
  return await service.planSlides(scriptId, sections, templates);
}

/**
 * Render slides to images (stub - implement with actual renderer)
 * This would typically use Marp, reveal.js, or similar
 */
export async function renderSlides(
  _specs: SlideSpec[],
  _templates: TemplateDef[],
  _outputDir: string
): Promise<Map<string, string>> {
  // TODO: Implement actual slide rendering
  // This should:
  // 1. Generate HTML/Markdown from templates and vars
  // 2. Use Marp/Puppeteer to render to PNG/PDF
  // 3. Return a map of section_id -> image paths

  throw new Error("Not implemented: renderSlides");
}

/**
 * Generate slide HTML from template (helper function)
 */
export function generateSlideHTML(
  slide: SlideUnit,
  template: TemplateDef
): string {
  // Simple template rendering - can be enhanced with proper template engine
  let html = `<div class="slide slide-${template.id}">`;

  switch (template.id) {
    case "bullet-hero":
      html += `<h1>${slide.vars.title || ""}</h1>`;
      if (Array.isArray(slide.vars.bullets)) {
        html += "<ul>";
        slide.vars.bullets.forEach((bullet: string) => {
          html += `<li>${bullet}</li>`;
        });
        html += "</ul>";
      }
      break;

    case "quote+visual":
      html += `<blockquote>${slide.vars.quote || ""}</blockquote>`;
      if (slide.vars.source) {
        html += `<cite>${slide.vars.source}</cite>`;
      }
      if (slide.vars.image_ref) {
        html += `<img src="${slide.vars.image_ref}" alt="Visual" />`;
      }
      break;

    case "diagram":
      html += `<h2>${slide.vars.caption || ""}</h2>`;
      if (slide.vars.graph_spec) {
        html += `<pre class="mermaid">${slide.vars.graph_spec}</pre>`;
      }
      break;

    case "title-slide":
      html += `<h1 class="title">${slide.vars.title || ""}</h1>`;
      if (slide.vars.subtitle) {
        html += `<h2 class="subtitle">${slide.vars.subtitle}</h2>`;
      }
      break;

    case "section-header":
      if (slide.vars.section_number) {
        html += `<span class="section-number">${slide.vars.section_number}</span>`;
      }
      html += `<h1>${slide.vars.section_title || ""}</h1>`;
      break;

    case "two-column":
      html += `<h2>${slide.vars.title || ""}</h2>`;
      html += '<div class="columns">';
      html += `<div class="column">${slide.vars.left_content || ""}</div>`;
      html += `<div class="column">${slide.vars.right_content || ""}</div>`;
      html += "</div>";
      break;

    case "fullscreen-image":
      if (slide.vars.image_ref) {
        html += `<img src="${slide.vars.image_ref}" alt="${
          slide.vars.caption || ""
        }" class="fullscreen" />`;
      }
      if (slide.vars.caption) {
        html += `<p class="caption">${slide.vars.caption}</p>`;
      }
      break;

    case "code-snippet":
      html += `<h3>${slide.vars.caption || ""}</h3>`;
      if (slide.vars.code) {
        html += `<pre><code class="language-${
          slide.vars.language || "text"
        }">${slide.vars.code}</code></pre>`;
      }
      break;

    default:
      html += "<p>Unknown template</p>";
  }

  html += "</div>";
  return html;
}

/**
 * Generate Marp markdown from slides
 */
export function generateMarpMarkdown(
  specs: SlideSpec[],
  templates: TemplateDef[]
): string {
  const templateMap = new Map(templates.map((t) => [t.id, t]));

  let markdown = `---
marp: true
theme: default
paginate: true
---

`;

  specs.forEach((spec) => {
    spec.slides.forEach((slide) => {
      const template = templateMap.get(slide.template);
      if (!template) {
        markdown += `\n---\n\n# Error: Unknown template ${slide.template}\n`;
        return;
      }

      markdown += "\n---\n\n";

      switch (template.id) {
        case "bullet-hero":
          markdown += `# ${slide.vars.title || ""}\n\n`;
          if (Array.isArray(slide.vars.bullets)) {
            slide.vars.bullets.forEach((bullet: string) => {
              markdown += `- ${bullet}\n`;
            });
          }
          break;

        case "quote+visual":
          markdown += `> ${slide.vars.quote || ""}\n\n`;
          if (slide.vars.source) {
            markdown += `— ${slide.vars.source}\n`;
          }
          break;

        case "diagram":
          markdown += `## ${slide.vars.caption || ""}\n\n`;
          if (slide.vars.graph_spec) {
            markdown += "```mermaid\n";
            markdown += slide.vars.graph_spec;
            markdown += "\n```\n";
          }
          break;

        case "title-slide":
          markdown += `# ${slide.vars.title || ""}\n\n`;
          if (slide.vars.subtitle) {
            markdown += `## ${slide.vars.subtitle}\n`;
          }
          break;

        case "section-header":
          if (slide.vars.section_number) {
            markdown += `<!-- _class: section-header -->\n`;
            markdown += `**${slide.vars.section_number}**\n\n`;
          }
          markdown += `# ${slide.vars.section_title || ""}\n`;
          break;

        case "code-snippet":
          markdown += `### ${slide.vars.caption || ""}\n\n`;
          if (slide.vars.code) {
            markdown += "```";
            markdown += slide.vars.language || "text";
            markdown += "\n";
            markdown += slide.vars.code;
            markdown += "\n```\n";
          }
          break;

        default:
          markdown += `# ${slide.vars.title || "Unknown Template"}\n`;
      }
    });
  });

  return markdown;
}

/**
 * Save slide specs to file
 */
export async function saveSlideSpecs(
  specs: SlideSpec[],
  outputPath: string
): Promise<void> {
  const content = JSON.stringify({ specs }, null, 2);
  await fs.writeFile(outputPath, content, "utf-8");
}

/**
 * Load slide specs from file
 */
export async function loadSlideSpecs(
  inputPath: string
): Promise<SlideSpec[]> {
  const content = await fs.readFile(inputPath, "utf-8");
  const data = JSON.parse(content);
  return data.specs;
}
