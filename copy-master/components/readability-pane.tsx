"use client";

import { motion, useReducedMotion } from "framer-motion";
import { GradeMeter } from "@/components/grade-meter";
import { HardSentences } from "@/components/hard-sentences";
import { StatTile } from "@/components/stat-tile";
import { useAnimatedNumber } from "@/hooks/use-animated-number";
import {
  formatCount,
  formatDecimal,
  formatDuration,
  pluralize,
} from "@/lib/format";
import { READING_WPM, type Analysis, type Sentence } from "@/lib/readability";

interface ReadabilityPaneProps {
  analysis: Analysis;
  activeSentenceId: number | null;
  onSelectSentence: (sentence: Sentence) => void;
  onHoverSentence: (id: number | null) => void;
}

export function ReadabilityPane({
  analysis,
  activeSentenceId,
  onSelectSentence,
  onHoverSentence,
}: ReadabilityPaneProps) {
  const reduceMotion = useReducedMotion();

  const words = useAnimatedNumber(analysis.words);
  const characters = useAnimatedNumber(analysis.characters);
  const readingSeconds = useAnimatedNumber(analysis.readingTimeSeconds);

  const readingTime = formatDuration(readingSeconds);
  const speakingTime = formatDuration(analysis.speakingTimeSeconds);

  const container = reduceMotion
    ? undefined
    : {
        hidden: {},
        show: { transition: { staggerChildren: 0.05 } },
      };

  const item = reduceMotion
    ? undefined
    : {
        hidden: { opacity: 0, y: 10 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
        },
      };

  return (
    <motion.div
      variants={container}
      initial={reduceMotion ? false : "hidden"}
      animate="show"
      className="flex flex-col gap-4 p-4 sm:p-5"
    >
      <motion.div variants={item}>
        <GradeMeter
          grade={analysis.grade}
          band={analysis.gradeBand}
          isEmpty={analysis.isEmpty}
        />
      </motion.div>

      {/* The three headline counts. */}
      <motion.div variants={item} className="grid grid-cols-3 gap-2.5">
        <StatTile label="Words" value={formatCount(words)} />
        <StatTile label="Chars" value={formatCount(characters)} />
        <StatTile
          label="Read"
          value={analysis.isEmpty ? "0" : readingTime.value}
          unit={analysis.isEmpty ? "sec" : readingTime.unit}
        />
      </motion.div>

      {/* Everything else, quieter. */}
      <motion.section
        variants={item}
        aria-label="Detail metrics"
        className="rounded-2xl border border-edge bg-surface p-5 shadow-[var(--shadow-panel)]"
      >
        <h2 className="text-[0.6875rem] font-semibold tracking-[0.1em] text-ink-faint uppercase">
          Detail
        </h2>

        <div className="mt-1 divide-y divide-edge">
          <StatTile
            quiet
            label="Reading ease"
            value={analysis.isEmpty ? "--" : formatDecimal(analysis.fleschReadingEase)}
            unit={analysis.isEmpty ? undefined : `/ 100 ${analysis.readingEaseBand.label}`}
          />
          <StatTile
            quiet
            label="Sentences"
            value={formatCount(analysis.sentenceCount)}
          />
          <StatTile
            quiet
            label="Paragraphs"
            value={formatCount(analysis.paragraphs)}
          />
          <StatTile
            quiet
            label="Avg sentence"
            value={
              analysis.isEmpty ? "--" : formatDecimal(analysis.avgWordsPerSentence)
            }
            unit={analysis.isEmpty ? undefined : "words"}
          />
          <StatTile
            quiet
            label="Longest sentence"
            value={
              analysis.longestSentence
                ? formatCount(analysis.longestSentence.wordCount)
                : "--"
            }
            unit={analysis.longestSentence ? "words" : undefined}
          />
          <StatTile
            quiet
            label="Words of 3+ syllables"
            value={formatCount(analysis.complexWords)}
          />
          <StatTile
            quiet
            label="Characters, no spaces"
            value={formatCount(analysis.charactersNoSpaces)}
          />
          <StatTile
            quiet
            label="Read aloud"
            value={analysis.isEmpty ? "--" : speakingTime.long}
          />
        </div>

        <p className="mt-4 border-t border-edge pt-3 text-[0.6875rem] leading-relaxed text-ink-faint">
          Grade is Flesch&ndash;Kincaid. Reading time assumes {READING_WPM} words
          a minute, the average for silent reading.
        </p>
      </motion.section>

      <motion.div variants={item}>
        <HardSentences
          analysis={analysis}
          activeSentenceId={activeSentenceId}
          onSelect={onSelectSentence}
          onHover={onHoverSentence}
        />
      </motion.div>

      {!analysis.isEmpty && (
        <p className="nums px-1 pb-2 text-[0.6875rem] text-ink-faint">
          {formatCount(analysis.sentenceCount)}{" "}
          {pluralize(analysis.sentenceCount, "sentence")},{" "}
          {formatCount(analysis.syllables)} syllables analysed.
        </p>
      )}
    </motion.div>
  );
}
