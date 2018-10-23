import * as fs from 'fs';
import * as path from 'path';
import { EOL } from 'os';
import * as ts from 'typescript';

import { getImportPaths, readAndParseConfig } from './util';

const tsconfigPath = path.join(__dirname, 'tsconfig.test.json');
const formatDiagnosticHost: ts.FormatDiagnosticsHost = {
  getCanonicalFileName: (fileName: string) => fileName,
  getCurrentDirectory: ts.sys.getCurrentDirectory,
  getNewLine: () => EOL,
};

const tsconfig = readAndParseConfig(tsconfigPath, ts, formatDiagnosticHost);
const program = ts.createProgram(tsconfig.fileNames, tsconfig.options);

function relativePath(fileName: string): string {
  return path.relative(path.dirname(tsconfig.fileNames[0]), fileName);
}

function cleanModulePath(fileName: string): string {
  return fileName.replace(/(index)?\.d\.ts$/, '');
}

const edges: Array<[string, string]> = program
  .getSourceFiles()
  .filter(sourceFile => {
    return !relativePath(sourceFile.fileName).startsWith('..');
  })
  .filter(({ fileName }) => fileName.includes('styles/') && !fileName.includes('overrides'))
  .map(sourceFile => {
    const referencedPaths = getImportPaths(sourceFile)
      .filter(modulePath => modulePath.startsWith('.'))
      .filter(modulePath => !modulePath.includes('StandardProps'))
      .map(modulePath => path.join(path.dirname(sourceFile.fileName), modulePath))
      .map(relativePath)
      .map(cleanModulePath)
      .map(fileName => (fileName === '' ? 'index' : fileName));

    const from = cleanModulePath(relativePath(sourceFile.fileName));

    return [from, referencedPaths] as [string, string[]];
  })
  .reduce(
    (acc, [from, targets]) => {
      acc.push(...targets.map(to => [from, to] as [string, string]));
      return acc;
    },
    [] as Array<[string, string]>,
  );

const nodes = Array.from(
  new Set(
    edges.reduce(
      (acc, [from, to]) => {
        acc.push(from, to);
        return acc;
      },
      [] as string[],
    ),
  ),
);

const jsonGraph = {
  graph: {
    directed: true,
    nodes: nodes.map(id => ({ id })),
    edges: edges.map(([source, target]) => ({ source, target })),
  },
};

fs.writeFileSync('mui-graph.json', JSON.stringify(jsonGraph, null, 2));
