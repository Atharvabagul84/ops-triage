// App evidence is an excerpt: every line must appear, in order, in the captured output.
// Only trailing whitespace is ignored; nothing is paraphrased or reformatted.
export const missingExcerptLines = (excerpt, captured) => {
  const source = captured.split('\n').map((line) => line.trimEnd());
  const missing = [];
  let cursor = 0;
  for (const line of excerpt.split('\n').map((item) => item.trimEnd())) {
    const index = source.indexOf(line, cursor);
    if (index < 0) missing.push(line);
    else cursor = index + 1;
  }
  return missing;
};

const quote = (arg) => {
  if (/^[A-Za-z0-9_./=:,@-]+$/.test(arg)) return arg;
  if (arg.includes("'")) throw new Error(`Lab command arguments cannot contain single quotes: ${arg}`);
  return `'${arg}'`;
};
export const displayCommand = (args) => ['kubectl', ...args].map(quote).join(' ');
