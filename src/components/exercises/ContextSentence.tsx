/* ContextSentence — the word in its sentence, shown after every graded
   answer and on an opened deck card. Every part of the word is set apart
   (both halves of a split separable verb), by weight and an underline,
   not colour alone. For a compound or a separable verb the word's parts
   follow, coloured by type and labelled in words, with the stressed
   syllable underlined. */
import type { ReactNode } from "react";
import { contextSentence, type ContextSentence as Context } from "../../lib/sentenceTarget";
import type { DictionaryEntry } from "../../lib/types";
import { WordParts } from "../WordParts";

export function ContextSentence({ entry, context, showParts = false }: { entry: DictionaryEntry; context?: Context | null; showParts?: boolean }) {
  const ctx = context ?? contextSentence(entry);
  if (!ctx) return null;
  const { sentence, target, translation } = ctx;
  const parts = target?.parts ?? [];
  const pieces: ReactNode[] = [];
  let at = 0;
  parts.forEach((p, i) => {
    pieces.push(sentence.slice(at, p.start));
    pieces.push(
      <mark key={i} className="context-sentence__target">
        {sentence.slice(p.start, p.end)}
      </mark>
    );
    at = p.end;
  });
  pieces.push(sentence.slice(at));
  return (
    <div className="context-sentence">
      <p className="context-sentence__nl" lang="nl">
        {pieces}
      </p>
      {translation && (
        <p className="context-sentence__en" lang="en">
          {translation}
        </p>
      )}
      {showParts && entry.snapshot && <WordParts snapshot={entry.snapshot} />}
    </div>
  );
}
