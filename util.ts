import { existsSync, readFileSync } from 'fs';
import { dirname, resolve as resolvePath } from 'path';
import * as ts from 'typescript';

/**
 * @param tsconfigPath the path
 * @param tsType an implemention of ts i.e. some version of it
 * @param formatDiagnosticHost if provided fails with Diagnostics support otherwise might silently ignore errors
 */
export function readAndParseConfig(
  tsconfigPath: string,
  tsType: typeof ts,
  formatDiagnosticHost?: ts.FormatDiagnosticsHost,
) {
  const dirPath = dirname(tsconfigPath);
  const { config, error } = tsType.readConfigFile(tsconfigPath, tsType.sys.readFile);
  if (error != null && formatDiagnosticHost != null) {
    throw new Error(tsType.formatDiagnostic(error, formatDiagnosticHost));
  }
  const parseConfigHost: ts.ParseConfigHost = {
    fileExists: existsSync,
    readDirectory: tsType.sys.readDirectory,
    readFile: file => readFileSync(file, 'utf8'),
    useCaseSensitiveFileNames: true,
  };
  const { errors, ...rest } = tsType.parseJsonConfigFileContent(
    config,
    parseConfigHost,
    resolvePath(dirPath),
  );
  if (errors.length > 0 && formatDiagnosticHost) {
    throw new Error(tsType.formatDiagnostics(errors, formatDiagnosticHost));
  }
  return rest;
}

/**
 * collects
 * import * from importPath;
 */
export function getImportPaths(sourceFile: ts.SourceFile): string[] {
  const paths: string[] = [];

  function visitNode(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      try {
        paths.push(node.moduleSpecifier.getFullText());
      } catch (err) {
        // TokenObject { kind: 9, text: '../styles/createBreakpoints' }
        paths.push(String((node.moduleSpecifier as any).text));
      }
    }
  }

  ts.forEachChild(sourceFile, visitNode);
  return paths;
}
