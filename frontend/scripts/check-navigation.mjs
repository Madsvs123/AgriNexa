/**
 * Navigation manifest assertions.
 *
 * The manifest drives routes, the nav rail, section panels, breadcrumbs, and
 * the command palette, so a mistake there breaks navigation everywhere at
 * once. Run with `npm run check:nav`.
 *
 * Uses esbuild (already a Vite dependency) rather than adding a test runner.
 */
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import Module from "node:module";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(root, "src/navigation/manifest.ts");
const appPath = resolve(root, "src/App.tsx");

const result = await build({
  entryPoints: [manifestPath],
  bundle: true,
  platform: "node",
  format: "cjs",
  write: false,
  external: ["lucide-react"],
  logLevel: "error",
});

// Stub the icon library; this check only cares about routing data.
const originalLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === "lucide-react") {
    return new Proxy({}, { get: (_t, p) => (p === "__esModule" ? true : function Icon() {}) });
  }
  return originalLoad.call(this, request, ...rest);
};

const module_ = { exports: {} };
new Function("module", "exports", "require", result.outputFiles[0].text)(
  module_,
  module_.exports,
  Module.createRequire(manifestPath),
);
const nav = module_.exports;

let failures = 0;
const check = (condition, message) => {
  if (!condition) {
    console.error(`  ✗ ${message}`);
    failures++;
  }
};

const { ROUTES, SECTIONS, PALETTE_ROUTES, matchRoute, breadcrumbsFor, sectionForPath, scoreRoute, sectionRoutes } = nav;

// Each route resolves back to itself from a concrete path.
for (const route of ROUTES) {
  const concrete = route.path.replace(/:[a-zA-Z]+/g, "abc123");
  check(matchRoute(concrete)?.id === route.id, `matchRoute("${concrete}") should resolve to "${route.id}"`);
}

// Literal segments must win over parameters.
for (const [path, id] of [
  ["/farms/new", "farm-new"],
  ["/fields/new", "field-new"],
  ["/crops/plans", "crop-plans"],
  ["/scouting/new", "scout-new"],
  ["/scouting/treatments", "treatments"],
  ["/farms/abc/edit", "farm-edit"],
  ["/settings/team", "team"],
]) {
  check(matchRoute(path)?.id === id, `"${path}" should match "${id}", got "${matchRoute(path)?.id}"`);
}

check(sectionForPath("/irrigation/zones/x") === "operate", "zone detail belongs to Operate");
check(sectionForPath("/fields/abc") === "land", "field detail belongs to Land");
check(sectionForPath("/unknown") === "home", "unknown paths fall back to Home");

const crumbs = breadcrumbsFor("/fields/abc", "North 80");
check(crumbs.length === 2, "field detail has two crumbs");
check(crumbs[0]?.path === "/fields", "parent crumb links to the list");
check(crumbs[1]?.label === "North 80", "leaf crumb uses the record name");
check(breadcrumbsFor("/farms/abc/edit").length === 3, "farm edit chains three crumbs");

const byId = (id) => ROUTES.find((r) => r.id === id);
check(scoreRoute(byId("irrigation"), "irr") > scoreRoute(byId("weather"), "irr"), "label prefix outranks other matches");
check(scoreRoute(byId("inventory"), "sku") > 0, "keyword matching works");
check(scoreRoute(byId("map"), "zzz") === 0, "non-matches score zero");

check(!PALETTE_ROUTES.some((r) => r.path.includes(":")), "palette excludes parameterised routes");
check(!PALETTE_ROUTES.some((r) => r.id === "search"), "palette excludes the search results page");
check(PALETTE_ROUTES.some((r) => r.id === "treatments"), "palette includes Treatments");

// The redesign's core promise: at most eight destinations visible at once.
for (const section of SECTIONS) {
  const count = sectionRoutes(section.id).length;
  check(count <= 8, `section "${section.id}" shows ${count} links, limit is 8`);
  check(Boolean(matchRoute(section.home)), `section "${section.id}" home "${section.home}" resolves`);
}

check(new Set(ROUTES.map((r) => r.id)).size === ROUTES.length, "route ids are unique");
check(new Set(ROUTES.map((r) => r.path)).size === ROUTES.length, "route paths are unique");

// Drift guard: every manifest route needs a page component, and vice versa.
const appSource = readFileSync(appPath, "utf8");
const pagesBlock = appSource.slice(appSource.indexOf("const PAGES"), appSource.indexOf("const ORDERED_ROUTES"));
const mapped = new Set([...pagesBlock.matchAll(/^\s*"?([a-zA-Z-]+)"?:\s*lazy\(/gm)].map((m) => m[1]));

for (const route of ROUTES) {
  check(mapped.has(route.id), `route "${route.id}" has no component in App.tsx PAGES`);
}
for (const id of mapped) {
  check(Boolean(byId(id)), `PAGES entry "${id}" has no route in the manifest`);
}

if (failures) {
  console.error(`\n${failures} navigation check(s) failed.`);
  process.exit(1);
}
console.log(`✓ navigation OK — ${ROUTES.length} routes, ${SECTIONS.length} sections, ${mapped.size} pages wired`);
