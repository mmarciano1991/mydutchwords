/* ContextSentence — the word in its sentence, shown after every graded
   answer. The word itself is set apart by weight and an underline, not by
   colour alone. */
import { contextSentence, type ContextSentence as Context } from "../../lib/sentenceTarget";
import type { DictionaryEntry } from "../../lib/types";

export function ContextSentence({ entry, context }: { entry: DictionaryEntry; context?: Context | null }) {
  const ctx = context ?? contextSentence(entry);
  if (!ctx) return null;
  const { sentence, target, translation } = ctx;
  return (
    <div className="context-sentence">
      <p className="context-sentence__nl" lang="nl">
        {target ? (
          <>
            {sentence.slice(0, target.start)}
            <mark className="context-sentence__target">{target.form}</mark>
            {sentence.slice(target.end)}
          </>
        ) : (
          sentence
        )}
      </p>
      {translation && (
        <p className="context-sentence__en" lang="en">
          {translation}
        </p>
      )}
    </div>
  );
}
