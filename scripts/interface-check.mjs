#!/usr/bin/env node
/** T-M8-08: audit public query methods, event emission sites and command owners. */
import ts from 'typescript';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sorted = (values) => [...new Set(values)].sort();
const categories = ['reader', 'events', 'commands'];

function declarationsOnly(line) {
  let code = false; let depth = 0; let result = '';
  for (const character of line) {
    if (character === '`') code = !code;
    if (!code && character === '(') depth += 1;
    if (depth === 0) result += character;
    if (!code && character === ')') depth = Math.max(0, depth - 1);
  }
  return result;
}

/** Only the Interfaces section; prose elsewhere is not an interface declaration. */
export function documentedInterfaces(markdown) {
  const section = /^## Interfaces[^\n]*\n([\s\S]*?)(?=^## |$(?![\s\S]))/m.exec(markdown)?.[1];
  if (section === undefined) throw new Error('missing Interfaces section');
  const result = { reader: [], events: [], commands: [] };
  let category = '';
  for (const line of section.split(/\r?\n/)) {
    if (line.startsWith('### ')) {
      category = /^### Reader/.test(line) ? 'reader' : /^### Events emitted/.test(line) ? 'events' :
        /^### Commands(?: \(|$)/.test(line) ? 'commands' : '';
      continue;
    }
    if (line.startsWith('Implementation note:')) continue;
    for (const match of declarationsOnly(line).matchAll(/`([^`]+)`/g)) {
      const name = category === 'reader' ? /^([a-zA-Z]+\.\w+)/.exec(match[1])?.[1] :
        /^(\p{Lu}\w*)/u.exec(match[1])?.[1];
      if (category && name) result[category].push(name);
      // Typed accessors such as hardness(idx) are unqualified in 05's list.
      if (category === 'reader' && !name) {
        const method = /^(\w+)\(/.exec(match[1])?.[1];
        const namespace = /`(\w+)\./.exec(line)?.[1];
        if (method && namespace) result.reader.push(`${namespace}.${method}`);
      }
    }
  }
  // Reviewed one-line amendments are explicit set deltas, never an ignore list in code.
  for (const line of section.split(/\r?\n/).filter((s) => s.startsWith('Implementation note:'))) {
    for (const delta of line.matchAll(/(reader|events|commands) (additions|references): ([^;\n]+)/g)) {
      const names = [...delta[3].matchAll(/`([^`]+)`/g)].map((m) => m[1]);
      if (delta[2] === 'additions') result[delta[1]].push(...names);
      else result[delta[1]] = result[delta[1]].filter((name) => !names.includes(name));
    }
    // Existing approved reader notes predate the audit's delta notation.
    if (!line.includes('reader additions:') && !line.includes('reader references:')) {
      for (const m of line.matchAll(/`((?:items|pathing)\.\w+)\(/g)) {
        if (!line.slice(m.index).split(';')[0].includes('hook')) result.reader.push(m[1]);
      }
    }
  }
  return Object.fromEntries(categories.map((key) => [key, sorted(result[key])]));
}

export function differences(actual, expected) {
  return categories.flatMap((category) => [
    ...actual[category].filter((name) => !expected[category].includes(name)).map((name) => `${category} undocumented: ${name}`),
    ...expected[category].filter((name) => !actual[category].includes(name)).map((name) => `${category} missing in code: ${name}`),
  ]);
}

function programAt(directory) {
  const configPath = join(directory, 'tsconfig.json');
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, directory);
  if (parsed.errors.length) throw new Error(ts.flattenDiagnosticMessageText(parsed.errors[0].messageText, '\n'));
  return ts.createProgram(parsed.fileNames, parsed.options);
}

function strings(type) {
  if (type.isStringLiteral()) return [type.value];
  if (type.isUnion()) return type.types.flatMap(strings);
  return [];
}

/** Includes inherited callable properties; excludes state fields and mutation services. */
export function methods(checker, declaration, namespace) {
  return checker.getPropertiesOfType(checker.getTypeAtLocation(declaration)).filter((property) => {
    const site = property.valueDeclaration ?? property.declarations?.[0] ?? declaration;
    return checker.getTypeOfSymbolAtLocation(property, site).getCallSignatures().length > 0;
  }).map((property) => `${namespace}.${property.name}`);
}

/** Literal/conditional event types, narrow factories, batches, and generic forwarding. */
export function emissions(source, checker) {
  const found = [];
  const broad = [];
  function eventTypes(expression) {
    if (ts.isArrayLiteralExpression(expression)) return expression.elements.flatMap(eventTypes);
    if (ts.isObjectLiteralExpression(expression)) {
      const field = expression.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText(source).replace(/['"]/g, '') === 'type');
      if (field) return strings(checker.getTypeAtLocation(field.initializer));
    }
    const type = checker.getTypeAtLocation(expression);
    const property = checker.getPropertyOfType(type, 'type');
    if (!property) return [];
    const propertyType = checker.getTypeOfSymbolAtLocation(property, expression);
    const names = strings(propertyType);
    // A callback forwarding arbitrary GameEvent records is not an emitter of the whole catalog.
    const catalogType = property.declarations?.some((declaration) => declaration.type &&
      ts.isTypeReferenceNode(declaration.type) && declaration.type.typeName.getText() === 'EventType');
    return catalogType ? [] : names;
  }
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const name = ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text :
        ts.isIdentifier(node.expression) ? node.expression.text : '';
      const signature = checker.getResolvedSignature(node);
      const eventArguments = signature?.parameters.flatMap((parameter, index) => {
        const declaration = parameter.valueDeclaration;
        const type = declaration && ts.isParameter(declaration) ? declaration.type : undefined;
        return type && ts.isTypeReferenceNode(type) && type.typeName.getText() === 'GameEvent' ? [index] : [];
      }) ?? [];
      // Notifications and injected event callbacks are typed with the same GameEvent contract.
      const indexes = ['emit', 'deliver', 'emitAppEvent'].includes(name) ? [0] :
        name === 'handle' ? [] : eventArguments;
      for (const index of indexes) {
        const argument = node.arguments[index];
        if (!argument) continue;
        const names = eventTypes(argument);
        found.push(...names);
        if (ts.isObjectLiteralExpression(argument) && names.length === 0) broad.push(`${source.fileName}:${source.getLineAndCharacterOfPosition(node.pos).line + 1}`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (broad.length) throw new Error(`unresolved event emission: ${broad.join(', ')}`);
  return sorted(found);
}

export function audit(directory = root) {
  const program = programAt(directory);
  const checker = program.getTypeChecker();
  const docs = readdirSync(join(directory, 'docs/02-systems')).filter((name) => /^\d\d-.*\.md$/.test(name)).sort();
  const systems = new Map(docs.map((doc) => [doc.slice(0, 2), { id: doc.slice(0, 2), doc,
    reader: [], events: [], commands: [], sources: [] }]));
  const sourceFiles = program.getSourceFiles().filter((s) => relative(directory, s.fileName).replaceAll('\\', '/').startsWith('src/'));
  const folders = new Map();
  for (const source of sourceFiles) {
    const path = relative(directory, source.fileName).replaceAll('\\', '/');
    const folder = /^src\/systems\/([^/]+)\//.exec(path)?.[1];
    if (!folder) continue;
    if (!folders.has(folder)) folders.set(folder, []);
    folders.get(folder).push(source);
  }
  for (const [folder, files] of folders) {
    let id = folder === 'worldgen' ? '01' : folder === 'embark' ? '02' : null;
    for (const source of files) {
      for (const node of source.statements) {
        if (!ts.isClassDeclaration(node) || !node.heritageClauses?.some((clause) => clause.types.some((t) => t.expression.getText(source) === 'BaseSystem'))) continue;
        const field = node.members.find((m) => m.name?.getText(source) === 'id');
        const ids = field?.initializer ? strings(checker.getTypeAtLocation(field.initializer)) : [];
        id = ids.length === 1 ? ids[0] : null;
        if (!id) throw new Error(`system has no literal id: ${folder}`);
        const commands = node.members.find((m) => m.name?.getText(source) === 'ownsCommands');
        if (commands?.initializer) {
          const visit = (n) => { if (ts.isStringLiteral(n)) systems.get(id)?.commands.push(n.text); ts.forEachChild(n, visit); };
          visit(commands.initializer);
        }
      }
    }
    if (!systems.has(id)) throw new Error(`no system doc for ${folder} (${id})`);
    const record = systems.get(id);
    const namespace = folder === 'worldgen' ? 'world' : folder;
    for (const source of files) {
      record.sources.push(relative(directory, source.fileName));
      record.events.push(...emissions(source, checker));
      for (const node of source.statements) {
        if (ts.isInterfaceDeclaration(node) && node.name.text.endsWith('Reader') && node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
          record.reader.push(...methods(checker, node, namespace));
        }
        if (id === '02' && ts.isTypeAliasDeclaration(node) && node.name.text === 'EmbarkCommand') {
          for (const member of checker.getTypeAtLocation(node).types ?? []) {
            const property = checker.getPropertyOfType(member, 'type');
            if (property) record.commands.push(...strings(checker.getTypeOfSymbolAtLocation(property, node)));
          }
        }
      }
    }
  }
  const services = [['src/core/pathfinding.ts', 'PathingCoreReader', 'pathing'], ['src/core/spatial.ts', 'SpatialIndexReader', 'spatial']];
  for (const [path, name, namespace] of services) {
    const source = program.getSourceFile(join(directory, path));
    if (!source) throw new Error(`missing core service: ${path}`);
    const declaration = source.statements.find((n) => ts.isInterfaceDeclaration(n) && n.name.text === name);
    if (!declaration) throw new Error(`missing reader: ${name}`);
    systems.get('22').reader.push(...methods(checker, declaration, namespace));
  }
  for (const source of sourceFiles) {
    const path = relative(directory, source.fileName).replaceAll('\\', '/');
    if (['src/core/movement.ts', 'src/core/spatial.ts', 'src/core/pathfinding.ts'].includes(path)) systems.get('22').events.push(...emissions(source, checker));
    if (path.startsWith('src/app/')) {
      for (const name of emissions(source, checker)) {
        if (name !== 'WorldGenerated') throw new Error(`unassigned app emitter: ${path}: ${name}`);
        systems.get('01').events.push(name);
      }
    }
    if (path.startsWith('src/ui/')) systems.get('24').events.push(...emissions(source, checker));
    if (path.startsWith('src/render/')) systems.get('23').events.push(...emissions(source, checker));
  }
  return [...systems.values()].map((record) => {
    const actual = Object.fromEntries(categories.map((key) => [key, sorted(record[key])]));
    const expected = documentedInterfaces(readFileSync(join(directory, 'docs/02-systems', record.doc), 'utf8'));
    return { id: record.id, doc: record.doc, actual, expected, differences: differences(actual, expected) };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const results = audit();
  for (const result of results) {
    console.log(`${result.id} ${result.doc}`);
    for (const key of categories) console.log(`  ${key}: ${result.actual[key].join(', ') || '(none)'}`);
    for (const difference of result.differences) console.error(`  FAIL ${difference}`);
  }
  const errors = results.reduce((sum, result) => sum + result.differences.length, 0);
  console.log(`interface-check: ${results.length} documents, ${errors} differences`);
  if (errors) process.exitCode = 1;
}
