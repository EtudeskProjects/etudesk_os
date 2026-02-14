#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Codemod: migrate React Native `Alert.alert(...)` to our `useAlert()` modal.
 *
 * Goals:
 * - Safe, incremental automation (only transforms ExpressionStatements with Alert.alert calls).
 * - Adds `useAlert` import + `const alerts = useAlert()` when needed.
 * - Removes `Alert` from `react-native` imports when unused.
 *
 * Usage:
 *   node scripts/migrate-alerts.js --root app --write
 *   node scripts/migrate-alerts.js --root app --dry
 *
 * Notes:
 * - We intentionally skip complex `Alert.alert` call-sites (non-ExpressionStatement parents,
 *   options arg, etc.) and report them for manual follow-up.
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

function getText(src, node) {
  return src.text.slice(node.getStart(src), node.getEnd());
}

function hasNamedImport(importDecl, name) {
  const clause = importDecl.importClause;
  const bindings = clause && clause.namedBindings;
  if (!bindings || !ts.isNamedImports(bindings)) return false;
  return bindings.elements.some((el) => el.name.text === name);
}

function addNamedImportToDecl(srcText, importDecl, namesToAdd) {
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

  // If it's the only named import, remove the entire import declaration.
  if (els.length === 1) {
    return { start: importDecl.getFullStart(), end: importDecl.getEnd(), text: '' };
  }

  // Remove element, including the adjacent comma.
  const el = els[idx];
  const start = el.getFullStart();
  const end = el.getEnd();

  // Expand to include a trailing comma if present, otherwise include a leading comma.
  const after = src.text.slice(end, Math.min(src.text.length, end + 2));
  if (after.startsWith(',')) {
    return { start, end: end + 1, text: '' };
  }
  // Try to remove preceding comma.
  const before = src.text.slice(Math.max(0, start - 2), start);
  if (before.endsWith(',')) {
    return { start: start - 1, end, text: '' };
  }
  return { start, end, text: '' };
}

function findDefaultExportFunction(src) {
  // `export default function X() {}` or `export default function() {}`
  for (const st of src.statements) {
    if (ts.isFunctionDeclaration(st)) {
      const hasDefault = (st.modifiers || []).some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
      const hasExport = (st.modifiers || []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      if (hasDefault && hasExport && st.body) return st;
    }
  }
  return null;
}

function insertAlertsHook(src, fn, relUseAlertPath) {
  const body = fn.body;
  if (!body) return [];
  const stmts = body.statements;
  const srcText = src.text;

  // Skip if alerts already defined.
  for (const st of stmts) {
    if (ts.isVariableStatement(st)) {
      const decls = st.declarationList.declarations;
      for (const d of decls) {
        if (ts.isIdentifier(d.name) && d.name.text === 'alerts') return [];
      }
    }
  }

  // Insert after initial hook declarations (`const ... = useX(...)`).
  let insertAfter = body.getStart(src) + 1; // after `{`
  for (const st of stmts) {
    if (!ts.isVariableStatement(st)) break;
    const decls = st.declarationList.declarations;
    const allHooky = decls.every((d) => {
      const init = d.initializer;
      if (!init || !ts.isCallExpression(init)) return false;
      const expr = init.expression;
      if (ts.isIdentifier(expr)) return expr.text.startsWith('use');
      return false;
    });
    if (allHooky) {
      insertAfter = st.getEnd();
      continue;
    }
    // Also accept destructured `const { colors } = useTheme();`
    const anyUse = decls.some((d) => {
      const init = d.initializer;
      return init && ts.isCallExpression(init) && ts.isIdentifier(init.expression) && init.expression.text.startsWith('use');
    });
    if (anyUse) insertAfter = st.getEnd();
  }

  // Ensure newline formatting.
  const indentMatch = srcText.slice(body.getStart(src), body.getEnd()).match(/\{\s*\n([ \t]+)/);
  const indent = indentMatch ? indentMatch[1] : '  ';
  const hookLine = `\n${indent}const alerts = useAlert();`;
  return [{ start: insertAfter, end: insertAfter, text: hookLine }];
}

function migrateFile(filePath) {
  const input = fs.readFileSync(filePath, 'utf8');
  const src = ts.createSourceFile(filePath, input, ts.ScriptTarget.Latest, true, filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

  const edits = [];
  const warnings = [];

  let sawAlertCall = false;
  let replacedCount = 0;

  // Locate relevant imports.
  let rnImport = null;
  let hasUseAlertImport = false;
  let useAlertImportDecl = null;

  for (const st of src.statements) {
    if (!ts.isImportDeclaration(st)) continue;
    const mod = st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier) ? st.moduleSpecifier.text : '';
    if (mod === 'react-native') rnImport = st;
    if (mod.includes('/src/contexts/AlertContext')) {
      if (hasNamedImport(st, 'useAlert')) {
        hasUseAlertImport = true;
        useAlertImportDecl = st;
      }
    }
  }

  function visit(node) {
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression) && expr.expression.text === 'Alert' && expr.name.text === 'alert') {
        sawAlertCall = true;

        // Only transform expression statements: `Alert.alert(...);`
        if (!ts.isExpressionStatement(node.parent)) {
          warnings.push({ kind: 'skip-non-statement', pos: node.getStart(src) });
          return;
        }

        const args = node.arguments;
        if (args.length === 0) {
          warnings.push({ kind: 'skip-empty', pos: node.getStart(src) });
          return;
        }

        if (args.length === 1 || args.length === 2) {
          const a0 = getText(src, args[0]);
          const a1 = args[1] ? `, ${getText(src, args[1])}` : '';
          const repl = `void alerts.alert(${a0}${a1});`;
          edits.push({ start: node.parent.getStart(src), end: node.parent.getEnd(), text: repl });
          replacedCount += 1;
          return;
        }

        if (args.length === 3 && ts.isArrayLiteralExpression(args[2])) {
          const title = getText(src, args[0]);
          const message = getText(src, args[1]);
          const buttons = getText(src, args[2]);
          const repl = `void alerts.showAlert({ title: ${title}, message: ${message}, buttons: ${buttons} });`;
          edits.push({ start: node.parent.getStart(src), end: node.parent.getEnd(), text: repl });
          replacedCount += 1;
          return;
        }

        warnings.push({ kind: 'skip-complex', pos: node.getStart(src) });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(src);

  if (!sawAlertCall || replacedCount === 0) {
    return { changed: false, replacedCount: 0, warnings: warnings.length, output: input };
  }

  // Ensure useAlert import exists.
  const mobileRoot = path.resolve(__dirname, '..');
  const useAlertAbs = path.join(mobileRoot, 'src', 'contexts', 'AlertContext');
  const relUseAlert = posixRel(path.dirname(filePath), useAlertAbs);

  if (!hasUseAlertImport) {
    // Insert after last import.
    const imports = src.statements.filter(ts.isImportDeclaration);
    const insertPos = imports.length ? imports[imports.length - 1].getEnd() : 0;
    edits.push({ start: insertPos, end: insertPos, text: `\nimport { useAlert } from '${relUseAlert}';` });
  } else if (useAlertImportDecl && !hasNamedImport(useAlertImportDecl, 'useAlert')) {
    const addEdit = addNamedImportToDecl(input, useAlertImportDecl, ['useAlert']);
    if (addEdit) edits.push(addEdit);
  }

  // Ensure `const alerts = useAlert();` exists in default export function.
  const fn = findDefaultExportFunction(src);
  if (fn) {
    edits.push(...insertAlertsHook(src, fn, relUseAlert));
  } else {
    warnings.push({ kind: 'no-default-fn', pos: 0 });
  }

  // Remove `Alert` from react-native import if present.
  // NOTE: Do not remove `Alert` import eagerly.
  // Some files have nested `Alert.alert(...)` inside button callbacks of another alert.
  // If we also rewrite the outer alert in the same pass, inner edits would overlap and be skipped,
  // leaving `Alert` usage in the file and breaking typecheck. We'll leave import cleanup for a later pass.

  // Apply edits in reverse order.
  const filtered = edits.filter(Boolean).sort((a, b) => b.start - a.start);
  let output = input;
  for (const e of filtered) {
    output = output.slice(0, e.start) + e.text + output.slice(e.end);
  }

  return { changed: output !== input, replacedCount, warnings: warnings.length, output, warningDetails: warnings };
}

function main() {
  const base = path.resolve(process.cwd(), ROOT_ARG);
  if (!fs.existsSync(base)) {
    console.error(`Root not found: ${base}`);
    process.exit(1);
  }

  const files = listFiles(base);
  let changedFiles = 0;
  let totalReplaced = 0;
  let totalWarnings = 0;
  const warned = [];

  for (const f of files) {
    const res = migrateFile(f);
    if (res.changed) {
      changedFiles += 1;
      totalReplaced += res.replacedCount;
      totalWarnings += res.warnings;
      if (res.warnings) warned.push({ file: f, warnings: res.warningDetails });
      if (WRITE) fs.writeFileSync(f, res.output, 'utf8');
    } else if (res.warnings) {
      totalWarnings += res.warnings;
      warned.push({ file: f, warnings: res.warningDetails });
    }
  }

  console.log(JSON.stringify({
    root: ROOT_ARG,
    mode: DRY ? 'dry' : 'write',
    changedFiles,
    totalReplaced,
    totalWarnings,
    warnedFiles: warned.length,
  }, null, 2));

  if (warned.length) {
    // Print first few for quick follow-up.
    console.log('\nWarned (sample):');
    for (const w of warned.slice(0, 12)) {
      console.log(`- ${path.relative(process.cwd(), w.file)}: ${w.warnings.map((x) => x.kind).join(', ')}`);
    }
    if (warned.length > 12) console.log(`... +${warned.length - 12} more`);
  }
}

main();
