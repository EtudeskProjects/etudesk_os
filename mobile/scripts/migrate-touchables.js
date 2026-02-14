#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Codemod: replace JSX <TouchableOpacity> usage with our <Tap> component.
 *
 * Why:
 * - Massive reduction of direct TouchableOpacity usage without changing layout/styles.
 * - Centralized press feedback (activeOpacity).
 *
 * Scope:
 * - Only replaces JSX tag names (opening/self-closing/closing) with `Tap`.
 * - Adds `Tap` import from `src/components/ui` (or augments existing UI import).
 * - Removes `TouchableOpacity` named import from `react-native` if no longer referenced.
 *
 * Usage:
 *   node scripts/migrate-touchables.js --root app --write
 *   node scripts/migrate-touchables.js --root src --write
 *   node scripts/migrate-touchables.js --root app --dry
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const args = new Set(process.argv.slice(2));
const ROOT_ARG = getArgValue('--root') || 'app';
const WRITE = args.has('--write');
const DRY = args.has('--dry') || !WRITE;

function getArgValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

function posixRel(from, to) {
  let rel = path.relative(from, to).split(path.sep).join('/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel;
}

function listFiles(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
      out.push(...listFiles(p));
    } else if (e.isFile()) {
      if (p.endsWith('.ts') || p.endsWith('.tsx')) out.push(p);
    }
  }
  return out;
}

function hasNamedImport(importDecl, name) {
  const clause = importDecl.importClause;
  const bindings = clause && clause.namedBindings;
  if (!bindings || !ts.isNamedImports(bindings)) return false;
  return bindings.elements.some((el) => el.name.text === name);
}

function addNamedImportToDecl(importDecl, namesToAdd) {
  const clause = importDecl.importClause;
  if (!clause || !clause.namedBindings || !ts.isNamedImports(clause.namedBindings)) return null;
  const named = clause.namedBindings;
  const existing = new Set(named.elements.map((e) => e.name.text));
  const add = namesToAdd.filter((n) => !existing.has(n));
  if (!add.length) return null;

  const lastEl = named.elements[named.elements.length - 1];
  const insertPos = lastEl.getEnd(); // before the closing `}`
  const insertion = `, ${add.join(', ')}`;
  return { start: insertPos, end: insertPos, text: insertion };
}

function removeNamedImportFromDecl(src, importDecl, name) {
  const clause = importDecl.importClause;
  const bindings = clause && clause.namedBindings;
  if (!bindings || !ts.isNamedImports(bindings)) return null;
  const els = bindings.elements;
  const idx = els.findIndex((e) => e.name.text === name);
  if (idx === -1) return null;

  if (els.length === 1) {
    return { start: importDecl.getFullStart(), end: importDecl.getEnd(), text: '' };
  }

  const el = els[idx];
  const start = el.getFullStart();
  const end = el.getEnd();

  const after = src.text.slice(end, Math.min(src.text.length, end + 2));
  if (after.startsWith(',')) {
    return { start, end: end + 1, text: '' };
  }
  const before = src.text.slice(Math.max(0, start - 2), start);
  if (before.endsWith(',')) {
    return { start: start - 1, end, text: '' };
  }
  return { start, end, text: '' };
}

function isTouchableJsxTag(tag) {
  return ts.isIdentifier(tag) && tag.text === 'TouchableOpacity';
}

function hasTapImport(src, uiRel) {
  for (const st of src.statements) {
    if (!ts.isImportDeclaration(st)) continue;
    const spec = st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier) ? st.moduleSpecifier.text : '';
    if (!spec) continue;
    // If the file already imports Tap from anywhere, don't add another.
    if (hasNamedImport(st, 'Tap')) return true;
    // Some files use the barrel with a different relative path; we still treat any named import Tap as enough.
    // uiRel is kept for inserting a new import when needed.
  }
  return false;
}

function main() {
  const rootDir = path.join(process.cwd(), ROOT_ARG);
  if (!fs.existsSync(rootDir)) {
    console.error(`Root not found: ${rootDir}`);
    process.exit(1);
  }

  const uiAbs = path.join(process.cwd(), 'src', 'components', 'ui');
  const files = listFiles(rootDir)
    .filter((f) => !f.split(path.sep).join('/').includes('/src/components/ui/')); // don't touch UI internals

  const touched = [];
  const skipped = [];

  for (const file of files) {
    const srcText = fs.readFileSync(file, 'utf8');
    // Handle both directions:
    // - pre-migration: file contains TouchableOpacity
    // - post-migration (broken state): file contains Tap tags but missing Tap import
    const hasTouchable = srcText.includes('TouchableOpacity');
    const hasTouchableTag = srcText.includes('<TouchableOpacity') || srcText.includes('</TouchableOpacity');
    const hasTapTag = srcText.includes('<Tap') || srcText.includes('</Tap>');
    if (!hasTouchableTag && !hasTapTag) continue;

    const src = ts.createSourceFile(
      file,
      srcText,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );

    const edits = [];
    let didChangeTag = false;

    function visit(node) {
      if (ts.isJsxOpeningElement(node) && isTouchableJsxTag(node.tagName)) {
        edits.push({ start: node.tagName.getStart(src), end: node.tagName.getEnd(), text: 'Tap' });
        didChangeTag = true;
      } else if (ts.isJsxSelfClosingElement(node) && isTouchableJsxTag(node.tagName)) {
        edits.push({ start: node.tagName.getStart(src), end: node.tagName.getEnd(), text: 'Tap' });
        didChangeTag = true;
      } else if (ts.isJsxClosingElement(node) && isTouchableJsxTag(node.tagName)) {
        edits.push({ start: node.tagName.getStart(src), end: node.tagName.getEnd(), text: 'Tap' });
        didChangeTag = true;
      }
      ts.forEachChild(node, visit);
    }
    visit(src);

    // We might be in a post-migration repair pass (Tap already in JSX, leftover import).
    // Only require tag change if the file still has TouchableOpacity JSX tags.
    if (hasTouchableTag && !didChangeTag) continue;

    // Import edits
    let hasReactNativeTouchableImport = false;
    let reactNativeImportDecl = null;
    let uiImportDecl = null;
    const uiRel = posixRel(path.dirname(file), uiAbs);

    for (const st of src.statements) {
      if (!ts.isImportDeclaration(st)) continue;
      const spec = st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier) ? st.moduleSpecifier.text : '';
      if (spec === 'react-native') {
        if (hasNamedImport(st, 'TouchableOpacity')) {
          hasReactNativeTouchableImport = true;
          reactNativeImportDecl = st;
        }
      }
      if (spec === uiRel || spec.endsWith('/src/components/ui')) {
        uiImportDecl = st;
      }
    }

    // Apply tag edits to get updated text for import decisions
    const updatedOnce = applyEdits(srcText, edits);

    // Add Tap import (prefer existing UI barrel import)
    if (!hasTapImport(src, uiRel)) {
      if (uiImportDecl) {
        const add = addNamedImportToDecl(uiImportDecl, ['Tap']);
        if (add) edits.push(add);
      } else {
        // Insert a new import after last react-native import (or at top).
        let insertPos = 0;
        let lastImportEnd = 0;
        for (const st of src.statements) {
          if (ts.isImportDeclaration(st)) lastImportEnd = Math.max(lastImportEnd, st.getEnd());
        }
        insertPos = lastImportEnd || 0;
        const ins = `\nimport { Tap } from '${uiRel}';\n`;
        edits.push({ start: insertPos, end: insertPos, text: ins });
      }
    }

    // Remove TouchableOpacity from react-native import if it's now unused.
    const updatedTwice = applyEdits(srcText, edits);
    if (hasReactNativeTouchableImport && reactNativeImportDecl) {
      const importStart = reactNativeImportDecl.getFullStart();
      const importEnd = reactNativeImportDecl.getEnd();
      const withoutImport = updatedTwice.slice(0, importStart) + updatedTwice.slice(importEnd);
      const stillRefsTouchable = /\bTouchableOpacity\b/.test(withoutImport);
      if (!stillRefsTouchable) {
        const rm = removeNamedImportFromDecl(src, reactNativeImportDecl, 'TouchableOpacity');
        if (rm) edits.push(rm);
      }
    }

    const finalText = applyEdits(srcText, edits);
    if (finalText === srcText) {
      skipped.push(file);
      continue;
    }

    touched.push(file);
    if (!DRY) fs.writeFileSync(file, finalText, 'utf8');
  }

  console.log(`root=${ROOT_ARG} dry=${DRY}`);
  console.log(`touched=${touched.length} skipped=${skipped.length}`);
  if (DRY && touched.length) {
    console.log('Example touched files:');
    for (const f of touched.slice(0, 20)) console.log(`- ${path.relative(process.cwd(), f)}`);
  }
}

function applyEdits(text, edits) {
  if (!edits.length) return text;
  const sorted = edits.slice().sort((a, b) => b.start - a.start);
  let out = text;
  for (const e of sorted) {
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
  }
  return out;
}

main();
