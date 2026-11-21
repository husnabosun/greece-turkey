/** Templates for the short English dates of `src/lib/dates.ts` ("12 Oct", "12 Oct 2026", "12 Oct, 08:40"). */
const EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function monthTemplates(names: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  EN.forEach((m, i) => {
    out[`{d} ${m}`] = `{d} ${names[i]}`;
    out[`{d} ${m} {y}`] = `{d} ${names[i]} {y}`;
    out[`{d} ${m}, {time}`] = `{d} ${names[i]}, {time}`;
  });
  return out;
}
