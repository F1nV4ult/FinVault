#!/usr/bin/env node
/**
 * Minify standalone JS + CSS to `*.min.js` / `*.min.css` alongside source.
 *
 * Usage:  npm run build           (write the .min outputs)
 *         npm run build -- --check (verify committed .min match source; CI gate)
 *
 * HTML files reference the `.min.*` outputs. Source files remain editable;
 * re-run this script after any edit. Sourcemaps are intentionally NOT emitted
 * — a public .map de-minifies the bundle back to original source.
 *
 * --check mode rebuilds every target in memory and compares to the committed
 * .min, exiting non-zero on any mismatch — so a source edit shipped without a
 * rebuild (stale minified output) is caught in CI instead of in production.
 *
 * The Osiris ES-module client (components/osiris/) is bundled + minified here:
 * osiris.js and osirisIngestion.js → single ESM .min.js files (imports inlined);
 * the classic stochasticWorker.js is minified in place. The HTML/import sites
 * load the .min outputs and the raw sources are excluded from the deploy.
 */
const esbuild = require('esbuild');
const fs = require('fs');

const CHECK = process.argv.includes('--check');

const JS_TARGETS = [
    'script.js',
    'osiris-bg.js',
    'sentinel-promo.js',
    'sentinel.v2.js',
    'enhance.js',
    'components/snapshots/snapshots.js'
];

const CSS_TARGETS = [
    'style.css'
];

// Bundled ESM clients (imports inlined).
const OSIRIS_BUNDLES = [
    'components/osiris/osiris.js',
    'components/osiris/osirisIngestion.js',
];

function fmt(n) { return (n / 1024).toFixed(1) + ' KB'; }

const mismatches = [];
let totalBefore = 0, totalAfter = 0;

// Build one target. In --check mode, build in memory and compare to the
// committed file; otherwise write it and log the size delta.
async function emit(opts, out, label) {
    if (CHECK) {
        const res = await esbuild.build({ ...opts, outfile: out, write: false });
        const built = res.outputFiles[0].text;
        let committed = null;
        try { committed = fs.readFileSync(out, 'utf8'); } catch { /* missing */ }
        // Compare content, not line-ending encoding — the working tree may be
        // CRLF on Windows (autocrlf) while esbuild emits LF.
        const norm = s => s == null ? null : s.replace(/\r\n/g, '\n');
        if (norm(committed) === norm(built)) {
            console.log(`  ✓ ${label}`);
        } else {
            mismatches.push(out);
            console.error(`  ✗ ${label} — ${out}${committed === null ? ' missing' : ' differs from source build'}`);
        }
        return;
    }
    await esbuild.build({ ...opts, outfile: out });
    const before = fs.statSync(opts.entryPoints[0]).size, after = fs.statSync(out).size;
    totalBefore += before; totalAfter += after;
    console.log(`${label}  (${fmt(before)})  →  ${out}  (${fmt(after)})`);
}

(async () => {
    console.log(CHECK ? 'Verifying committed .min outputs match source…' : 'Building…');

    for (const file of JS_TARGETS) {
        if (!fs.existsSync(file)) { console.warn(`SKIP — missing: ${file}`); continue; }
        await emit({ entryPoints: [file], minify: true, sourcemap: false, target: 'es2020', bundle: false, legalComments: 'none' },
            file.replace(/\.js$/, '.min.js'), file);
    }

    for (const file of CSS_TARGETS) {
        if (!fs.existsSync(file)) { console.warn(`SKIP — missing: ${file}`); continue; }
        await emit({ entryPoints: [file], minify: true, sourcemap: false, loader: { '.css': 'css' } },
            file.replace(/\.css$/, '.min.css'), file);
    }

    for (const file of OSIRIS_BUNDLES) {
        if (!fs.existsSync(file)) { console.warn(`SKIP — missing: ${file}`); continue; }
        await emit({ entryPoints: [file], bundle: true, minify: true, format: 'esm', target: 'es2020', sourcemap: false, legalComments: 'none' },
            file.replace(/\.js$/, '.min.js'), file);
    }

    // stochasticWorker.js is a classic worker (no imports) — minify only.
    {
        const file = 'components/osiris/stochasticWorker.js';
        if (fs.existsSync(file)) {
            await emit({ entryPoints: [file], bundle: false, minify: true, target: 'es2020', sourcemap: false, legalComments: 'none' },
                file.replace(/\.js$/, '.min.js'), file);
        }
    }

    if (CHECK) {
        if (mismatches.length) {
            console.error(`\n✗ ${mismatches.length} stale build artifact(s). Run \`npm run build\` and commit the .min files.`);
            process.exit(1);
        }
        console.log('\n✓ All committed .min outputs are in sync with source.');
        return;
    }
    console.log(`\nTotal:  ${fmt(totalBefore)}  →  ${fmt(totalAfter)}  (saved ${fmt(totalBefore - totalAfter)}, ${((1 - totalAfter / totalBefore) * 100).toFixed(1)}%)`);
})().catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
});
