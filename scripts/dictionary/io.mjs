/* Streaming readers for the pipeline's sources: gzipped JSON lines and
   bzip2 TSV (Tatoeba). Nothing is held in memory beyond what a caller
   keeps. */
import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { spawn } from "node:child_process";

/** Lines split on "\n" only. readline also breaks on a bare "\r", which
 *  occurs inside some Wiktionary strings and would cut a record in two. */
async function* splitLines(stream) {
  let rest = "";
  for await (const chunk of stream.setEncoding("utf8")) {
    const parts = (rest + chunk).split("\n");
    rest = parts.pop();
    yield* parts;
  }
  if (rest) yield rest;
}

/** Calls `onRecord` for every JSON line of a .jsonl.gz file. */
export async function eachJsonl(path, onRecord) {
  let n = 0;
  for await (const line of splitLines(createReadStream(path).pipe(createGunzip()))) {
    if (!line.trim()) continue;
    onRecord(JSON.parse(line));
    n++;
  }
  return n;
}

/** Every line of a plain text file. */
export async function eachLine(path, onLine) {
  const lines = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  for await (const line of lines) onLine(line);
}

/** Every line of a .bz2 file (decompressed by the system bzip2, present on
 *  macOS and the GitHub Ubuntu runners). */
export async function eachBz2Line(path, onLine) {
  const child = spawn("bzip2", ["-dc", path]);
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  for await (const line of lines) onLine(line);
  await new Promise((resolve, reject) => {
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`bzip2 exited ${code} on ${path}`))));
  });
}
