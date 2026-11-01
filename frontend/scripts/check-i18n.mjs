/**
 * Translation catalogue checks.
 *
 * English is the source of truth. Every other language must define exactly the
 * same keys — a missing key silently renders English, which looks like a bug
 * nobody reports, and an extra key is dead weight a translator maintains for
 * nothing. Run with `npm run check:i18n`.
 */
import { build } from "esbuild";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const localesDir = join(root, "public", "locales");
const SOURCE = "en";
/** Arabic needs every plural form CLDR defines for it. */
const ARABIC_PLURAL_SUFFIXES = ["zero", "one", "two", "few", "many", "other"];

let failures = 0;
const fail = (msg) => {
  console.error(`  ✗ ${msg}`);
  failures++;
};

const languages = readdirSync(localesDir).filter((d) => !d.startsWith("."));
if (!languages.includes(SOURCE)) {
  console.error(`No "${SOURCE}" catalogue in ${localesDir}`);
  process.exit(1);
}
const targets = languages.filter((l) => l !== SOURCE);

function flatten(obj, prefix = "") {
  const out = new Map();
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const [ck, cv] of flatten(v, key)) out.set(ck, cv);
    } else {
      out.set(key, v);
    }
  }
  return out;
}

/** `units.acres_one` and `units.acres_other` are one logical key. */
function pluralBase(key) {
  const m = key.match(/_(zero|one|two|few|many|other)$/);
  return m ? key.slice(0, -m[0].length) : null;
}

const namespaces = readdirSync(join(localesDir, SOURCE))
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""));

let totalKeys = 0;

for (const ns of namespaces) {
  const sourcePath = join(localesDir, SOURCE, `${ns}.json`);
  const source = flatten(JSON.parse(readFileSync(sourcePath, "utf8")));
  totalKeys += source.size;

  // Logical keys, with plural variants collapsed.
  const sourceLogical = new Set([...source.keys()].map((k) => pluralBase(k) ?? k));

  for (const lang of targets) {
    const path = join(localesDir, lang, `${ns}.json`);
    if (!existsSync(path)) {
      fail(`${lang}/${ns}.json is missing`);
      continue;
    }
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(path, "utf8"));
    } catch (err) {
      fail(`${lang}/${ns}.json is not valid JSON: ${err.message}`);
      continue;
    }
    const target = flatten(parsed);
    const targetLogical = new Set([...target.keys()].map((k) => pluralBase(k) ?? k));

    for (const key of sourceLogical) {
      if (!targetLogical.has(key)) fail(`${lang}/${ns}: missing key "${key}"`);
    }
    for (const key of targetLogical) {
      if (!sourceLogical.has(key)) fail(`${lang}/${ns}: key "${key}" is not in ${SOURCE}`);
    }

    for (const [key, value] of target) {
      if (typeof value !== "string") {
        fail(`${lang}/${ns}: "${key}" should be a string`);
        continue;
      }
      if (!value.trim() && (source.get(key) ?? "").trim()) {
        fail(`${lang}/${ns}: "${key}" is empty but translated in ${SOURCE}`);
      }
      // Interpolation placeholders must survive translation or the UI prints
      // a literal {{value}} to the user.
      const expected = new Set([...(source.get(key) ?? "").matchAll(/{{(\w+)}}/g)].map((m) => m[1]));
      const actual = new Set([...value.matchAll(/{{(\w+)}}/g)].map((m) => m[1]));
      // Plural handling.
      //
      // Arabic defines six CLDR categories where English defines two, so a
      // key like `..._few` has no English counterpart to compare against.
      // Resolve the contract from the base key's English forms instead: any
      // placeholder English uses in *any* variant is legitimate here.
      const base = pluralBase(key);
      const isPluralVariant = base !== null;
      const placeholdersIn = (text) =>
        new Set([...(text ?? "").matchAll(/{{(\w+)}}/g)].map((m) => m[1]));
      let allowed = expected;
      if (isPluralVariant) {
        allowed = new Set(["count"]);
        for (const [sourceKey, sourceValue] of source) {
          if (pluralBase(sourceKey) === base) {
            for (const p of placeholdersIn(sourceValue)) allowed.add(p);
          }
        }
      } else {
        // A non-plural key must carry every placeholder English uses, or the
        // translated sentence silently loses a value.
        for (const p of expected) {
          if (!actual.has(p)) fail(`${lang}/${ns}: "${key}" drops placeholder {{${p}}}`);
        }
      }
      for (const p of actual) {
        if (!allowed.has(p)) fail(`${lang}/${ns}: "${key}" adds unknown placeholder {{${p}}}`);
      }
    }

    // Arabic pluralisation has six categories; falling back to `_other` reads
    // as broken grammar for 1, 2, and small counts.
    if (lang === "ar") {
      const pluralBases = new Set(
        [...source.keys()].map(pluralBase).filter(Boolean),
      );
      for (const base of pluralBases) {
        for (const suffix of ARABIC_PLURAL_SUFFIXES) {
          if (!target.has(`${base}_${suffix}`)) {
            fail(`ar/${ns}: plural "${base}" is missing the "${suffix}" form`);
          }
        }
      }
    }
  }
}

// ── Country map parity with the backend ──────────────────────────────────
//
// `apps/common/i18n.py` and `src/i18n/config.ts` both map country to language:
// the API decides for the detect endpoint, the SPA for its offline time-zone
// fallback. If they disagree, a user is switched one way on first load and
// another on the next request.
const configBundle = await build({
  entryPoints: [join(root, "src", "i18n", "config.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  write: false,
  external: ["date-fns", "date-fns/locale"],
  logLevel: "error",
});

const Module = (await import("node:module")).default;
const originalLoad = Module._load;
Module._load = function (request, ...rest) {
  // The map under test needs no date-fns locale data.
  if (request.startsWith("date-fns")) return new Proxy({}, { get: () => ({}) });
  return originalLoad.call(this, request, ...rest);
};
const mod = { exports: {} };
new Function("module", "exports", "require", configBundle.outputFiles[0].text)(
  mod,
  mod.exports,
  Module.createRequire(join(root, "src", "i18n", "config.ts")),
);
Module._load = originalLoad;
const { languageForCountry } = mod.exports;

const backend = readFileSync(
  resolve(root, "..", "backend", "apps", "common", "i18n.py"),
  "utf8",
);
function pyCountrySet(name) {
  const m = backend.match(new RegExp(`${name} = frozenset\\(\\s*\\{([^}]*)\\}`));
  if (!m) return null;
  return new Set([...m[1].matchAll(/"([A-Z]{2})"/g)].map((x) => x[1]));
}
const pyArabic = pyCountrySet("ARABIC_COUNTRIES");
const pySpanish = pyCountrySet("SPANISH_COUNTRIES");
if (!pyArabic || !pySpanish) {
  fail("could not read the country sets from backend/apps/common/i18n.py");
} else {
  for (const country of pyArabic) {
    if (languageForCountry(country) !== "ar") {
      fail(`country ${country} is Arabic in the API but ${languageForCountry(country)} in the SPA`);
    }
  }
  for (const country of pySpanish) {
    if (languageForCountry(country) !== "es") {
      fail(`country ${country} is Spanish in the API but ${languageForCountry(country)} in the SPA`);
    }
  }
  // And nothing extra on the frontend side.
  const allIso = [];
  for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) allIso.push(String.fromCharCode(a, b));
  for (const country of allIso) {
    const spa = languageForCountry(country);
    if (spa === "ar" && !pyArabic.has(country)) fail(`SPA maps ${country} to Arabic; the API does not`);
    if (spa === "es" && !pySpanish.has(country)) fail(`SPA maps ${country} to Spanish; the API does not`);
  }
  console.log(`  country map: ${pyArabic.size} Arabic, ${pySpanish.size} Spanish, in sync with the API`);
}

if (failures) {
  console.error(`\n${failures} translation problem(s).`);
  process.exit(1);
}
console.log(
  `✓ i18n OK — ${namespaces.length} namespace(s), ${totalKeys} source keys, ${targets.length} translation(s) in sync`,
);
