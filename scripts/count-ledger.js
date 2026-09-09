const fs = require("fs");
const s = fs.readFileSync("public/assets/js/data.js", "utf8");
eval(s.replace("window.FX", "global.FX"));
const cats = {};
FX.hates.forEach((h) => {
  cats[h[0]] = (cats[h[0]] || 0) + 1;
});
console.log("hates", FX.hates.length);
console.log("likes", FX.likes.length);
console.log("evidence", FX.evidence.length);
console.log("people", FX.people.length);
console.log(cats);
const missing = FX.evidence.flatMap((e) => {
  const people = [e.poster, e.quoted, ...(e.also || [])].filter(Boolean);
  return people.filter((p) => !p.url || !p.url.startsWith("https://x.com/"));
});
console.log("bad links", missing);
