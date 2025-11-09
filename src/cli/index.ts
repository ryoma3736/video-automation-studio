#!/usr/bin/env node
/**
 * CLI Tool for Video Automation Studio
 * Command-line interface for script processing and slide generation
 */

import { Command } from "commander";
import * as fs from "fs/promises";
import * as path from "path";
import { getDefaultScriptService } from "../services/scriptService";
import { loadTemplates, getDefaultSlideService, generateMarpMarkdown } from "../services/slideService";
import { getDefaultStorage } from "../services/storageService";
import { startServer } from "../api/server";
import { logger } from "../utils/logger";

const program = new Command();

// Initialize storage
const storage = getDefaultStorage();
storage.initialize().catch((err) => {
  logger.error("Failed to initialize storage", { error: err });
});

/**
 * studio:ingest - Ingest a new script from markdown file
 */
program
  .command("studio:ingest")
  .description("Ingest a new script from markdown file")
  .argument("<file>", "Path to markdown file")
  .option("-t, --title <title>", "Script title")
  .option("-a, --author <author>", "Script author")
  .option("-o, --output <path>", "Output path for script JSON", "./data/scripts")
  .action(async (file: string, options: any) => {
    try {
      await storage.initialize();
      const scriptService = getDefaultScriptService();
      
      const markdown = await fs.readFile(file, "utf-8");
      const title = options.title || path.basename(file, ".md");

      const script = scriptService.createScript(title, markdown, {
        author: options.author,
      });

      await scriptService.saveScript(script);

      console.log(`✅ Script ingested successfully`);
      console.log(`   ID: ${script.id}`);
      console.log(`   Title: ${script.title}`);
      console.log(`   Saved to storage`);
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * studio:normalize - Normalize a script
 */
program
  .command("studio:normalize")
  .description("Normalize a script using LLM")
  .argument("<scriptFile>", "Path to script JSON file")
  .option("-o, --output <path>", "Output path for normalized script")
  .option("-i, --script-id <id>", "Script ID (if using storage)")
  .action(async (scriptFile: string, options: any) => {
    try {
      await storage.initialize();
      const scriptService = getDefaultScriptService();

      let script;
      if (options.scriptId) {
        script = await scriptService.loadScript(options.scriptId);
        if (!script) {
          throw new Error(`Script not found: ${options.scriptId}`);
        }
      } else {
        const content = await fs.readFile(scriptFile, "utf-8");
        script = JSON.parse(content);
      }

      console.log("🤖 Normalizing script with LLM...");
      const normalized = await scriptService.normalizeScript(script);

      if (!options.scriptId && options.output) {
        await fs.writeFile(options.output, JSON.stringify(normalized, null, 2));
        console.log(`✅ Script normalized successfully`);
        console.log(`   Output: ${options.output}`);
      } else {
        console.log(`✅ Script normalized successfully`);
        console.log(`   Script ID: ${normalized.id}`);
      }
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * studio:segment - Segment a script into sections
 */
program
  .command("studio:segment")
  .description("Segment a normalized script into sections")
  .argument("<scriptFile>", "Path to script JSON file")
  .option("-o, --output <path>", "Output path for sections JSON")
  .option("-i, --script-id <id>", "Script ID (if using storage)")
  .action(async (scriptFile: string, options: any) => {
    try {
      await storage.initialize();
      const scriptService = getDefaultScriptService();

      let script;
      if (options.scriptId) {
        script = await scriptService.loadScript(options.scriptId);
        if (!script) {
          throw new Error(`Script not found: ${options.scriptId}`);
        }
      } else {
        const content = await fs.readFile(scriptFile, "utf-8");
        script = JSON.parse(content);
      }

      if (!script.normalized_markdown) {
        throw new Error("Script must be normalized before segmentation");
      }

      console.log("🤖 Segmenting script with LLM...");
      const sections = await scriptService.segmentScript(script);

      console.log(`✅ Script segmented successfully`);
      console.log(`   Sections: ${sections.length}`);
      console.log(`   Script ID: ${script.id}`);
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * slides:plan - Plan slides from sections
 */
program
  .command("slides:plan")
  .description("Plan slides from sections using LLM")
  .argument("<sectionsFile>", "Path to sections JSON file")
  .option("-t, --templates <path>", "Path to templates JSON")
  .option("-o, --output <path>", "Output path for slide specs JSON")
  .option("-i, --script-id <id>", "Script ID")
  .action(async (sectionsFile: string, options: any) => {
    try {
      await storage.initialize();
      const slideService = getDefaultSlideService();
      const scriptService = getDefaultScriptService();

      let sections;
      let scriptId = options.scriptId;

      if (scriptId) {
        sections = await scriptService.loadSections(scriptId);
        if (!sections) {
          throw new Error(`Sections not found for script: ${scriptId}`);
        }
      } else {
        const content = await fs.readFile(sectionsFile, "utf-8");
        const data = JSON.parse(content);
        sections = data.sections;
        scriptId = sections[0]?.scriptId || "temp";
      }

      const templates = await loadTemplates(options.templates);

      console.log("🤖 Planning slides with LLM...");
      const slideSpecs = await slideService.planSlides(scriptId, sections, templates);

      console.log(`✅ Slides planned successfully`);
      console.log(`   Specs: ${slideSpecs.length}`);
      console.log(`   Script ID: ${scriptId}`);
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * slides:render - Render slides to Marp markdown
 */
program
  .command("slides:render")
  .description("Render slides to Marp markdown")
  .argument("<specsFile>", "Path to slide specs JSON file")
  .option("-t, --templates <path>", "Path to templates JSON")
  .option("-o, --output <path>", "Output path for Marp markdown", "./output/slides.md")
  .action(async (specsFile: string, options: any) => {
    try {
      const content = await fs.readFile(specsFile, "utf-8");
      const { specs } = JSON.parse(content);

      const templates = await loadTemplates(options.templates);

      console.log("📝 Generating Marp markdown...");
      const markdown = generateMarpMarkdown(specs, templates);

      const outputPath = options.output;
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, markdown);

      console.log(`✅ Slides rendered successfully`);
      console.log(`   Output: ${outputPath}`);
      console.log(`   Use Marp CLI to convert to PDF/PNG:`);
      console.log(`   npx @marp-team/marp-cli ${outputPath} -o output.pdf`);
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * server:start - Start API server
 */
program
  .command("server:start")
  .description("Start the API server")
  .option("-p, --port <port>", "Port number", "3000")
  .action((options: any) => {
    const port = parseInt(options.port, 10);
    startServer(port);
  });

/**
 * info - Display system information
 */
program
  .command("info")
  .description("Display system information")
  .action(async () => {
    console.log("📊 Video Automation Studio");
    console.log("   Version: 1.0.0");
    console.log("   Node:", process.version);
    console.log("");
    console.log("Available commands:");
    console.log("   studio:ingest    - Ingest markdown script");
    console.log("   studio:normalize - Normalize script with LLM");
    console.log("   studio:segment   - Segment script into sections");
    console.log("   slides:plan      - Plan slides from sections");
    console.log("   slides:render    - Render slides to Marp markdown");
    console.log("   server:start     - Start API server");
  });

// Parse command line arguments
program.parse();
