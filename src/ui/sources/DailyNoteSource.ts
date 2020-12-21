import type { Moment } from "moment";
import { Notice, parseFrontMatterTags, TFile } from "obsidian";
import {
  getAllDailyNotes,
  getDailyNote,
  getDateUID,
} from "obsidian-daily-notes-interface";
import { get } from "svelte/store";

import type { ISettings } from "src/settings";
import { clamp, getWordCount } from "src/ui/utils";

import { CalendarSource, IDayMetadata, IDot } from "./CalendarSource";
import { activeFile, dailyNotes } from "../stores";

const NUM_MAX_DOTS = 5;

export async function getWordLengthAsDots(
  note: TFile,
  settings: ISettings
): Promise<number> {
  if (!note || settings.wordsPerDot <= 0) {
    return 0;
  }
  const fileContents = await window.app.vault.cachedRead(note);

  const numDots = getWordCount(fileContents) / settings.wordsPerDot;
  return clamp(Math.floor(numDots), 1, NUM_MAX_DOTS);
}

export function getNoteTags(note: TFile | null): string[] {
  if (!note) {
    return [];
  }

  const { metadataCache } = window.app;
  const frontmatter = metadataCache.getFileCache(note)?.frontmatter;

  const tags = [];

  if (frontmatter) {
    const frontmatterTags = parseFrontMatterTags(frontmatter) || [];
    tags.push(...frontmatterTags);
  }

  return tags.map((tag) => tag.substring(1));
}

export async function getNumberOfRemainingTasks(note: TFile): Promise<number> {
  if (!note) {
    return 0;
  }

  const { vault } = window.app;
  const fileContents = await vault.cachedRead(note);
  return (fileContents.match(/(-|\*) \[ \]/g) || []).length;
}

export async function getDotsForDailyNote(
  dailyNote: TFile | null,
  settings: ISettings
): Promise<IDot[]> {
  if (!dailyNote) {
    return [];
  }
  const numSolidDots = await getWordLengthAsDots(dailyNote, settings);
  const numHollowDots = await getNumberOfRemainingTasks(dailyNote);

  const dots = [];
  for (let i = 0; i < numSolidDots; i++) {
    dots.push({
      color: "default",
      isFilled: true,
    });
  }
  for (let i = 0; i < numHollowDots; i++) {
    dots.push({
      color: "default",
      isFilled: false,
    });
  }

  return dots;
}

export default class DailyNoteSource extends CalendarSource {
  metadata: Record<string, IDayMetadata>;
  settings: ISettings;

  constructor(settings: ISettings) {
    super();

    this.metadata = {};
    this.settings = settings;

    dailyNotes.set(getAllDailyNotes());
  }

  isActive(file: TFile): boolean {
    const currentActiveFile = get(activeFile);
    return currentActiveFile && currentActiveFile == file;
  }

  getClasses(file: TFile): string[] {
    const classes = [];
    if (file) {
      classes.push("has-note");
    }
    if (this.isActive(file)) {
      classes.push("active");
    }
    return classes;
  }

  buildMetadata(file: TFile): IDayMetadata {
    return {
      classes: this.getClasses(file),
      dataAttributes: getNoteTags(file),
      dots: getDotsForDailyNote(file, this.settings),
    };
  }

  getMetadata(date: Moment): IDayMetadata {
    const dateStr = getDateUID(date);
    return (
      this.metadata[dateStr] ??
      this.buildMetadata(getDailyNote(date, get(dailyNotes)))
    );
  }
}