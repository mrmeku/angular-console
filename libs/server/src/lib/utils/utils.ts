import { execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { platform } from 'os';
import * as path from 'path';
import * as JSON5 from 'json5';
import { schema } from '@angular-devkit/core';
import { standardFormats } from '@angular-devkit/schematics/src/formats';
import { Option } from '@angular/cli/models/interface';
import { parseJsonSchemaToOptions } from '@angular/cli/utilities/json-schema';
export interface SchematicDefaults {
  [name: string]: string;
}

export const files: { [path: string]: string[] } = {};
export let fileContents: { [path: string]: any } = {};

const IMPORTANT_FIELD_NAMES = [
  'name',
  'project',
  'module',
  'watch',
  'style',
  'directory',
  'port'
];
const IMPORTANT_FIELDS_SET = new Set(IMPORTANT_FIELD_NAMES);

export function exists(cmd: string): boolean {
  try {
    if (platform() === 'win32') {
      execSync(`where ${cmd}`).toString();
    } else {
      execSync(`which ${cmd}`).toString();
    }
    return true;
  } catch (error) {
    return false;
  }
}

export function findExecutable(command: string, cwd: string): string {
  const paths = (process.env.PATH as string).split(path.delimiter);
  if (paths === void 0 || paths.length === 0) {
    return path.join(cwd, command);
  }
  const r = findInPath(command, cwd, paths);
  return r ? r : path.join(cwd, command);
}

export function hasExecutable(command: string, cwd: string): boolean {
  const paths = (process.env.PATH as string).split(path.delimiter);
  if (paths === void 0 || paths.length === 0) {
    return false;
  } else {
    return !!findInPath(command, cwd, paths);
  }
}

function findInPath(
  command: string,
  cwd: string,
  paths: string[]
): string | undefined {
  for (const pathEntry of paths) {
    let fullPath: string;
    if (path.isAbsolute(pathEntry)) {
      fullPath = path.join(pathEntry, command);
    } else {
      fullPath = path.join(cwd, pathEntry, command);
    }
    if (existsSync(fullPath + '.exe')) {
      return fullPath + '.exe';
    } else if (existsSync(fullPath + '.cmd')) {
      return fullPath + '.cmd';
    } else if (existsSync(fullPath)) {
      return fullPath;
    }
  }
  return undefined;
}

export function findClosestNg(dir: string): string {
  if (directoryExists(path.join(dir, 'node_modules'))) {
    if (platform() === 'win32') {
      if (fileExistsSync(path.join(dir, 'ng.cmd'))) {
        return path.join(dir, 'ng.cmd');
      } else {
        return path.join(dir, 'node_modules', '.bin', 'ng.cmd');
      }
    } else {
      if (fileExistsSync(path.join(dir, 'node_modules', '.bin', 'ng'))) {
        return path.join(dir, 'node_modules', '.bin', 'ng');
      } else {
        return path.join(dir, 'node_modules', '@angular', 'cli', 'bin', 'ng');
      }
    }
  } else {
    return findClosestNg(path.dirname(dir));
  }
}

export function listOfUnnestedNpmPackages(nodeModulesDir: string): string[] {
  const res: string[] = [];
  if (!existsSync(nodeModulesDir)) {
    return res;
  }

  readdirSync(nodeModulesDir).forEach(npmPackageOrScope => {
    if (npmPackageOrScope.startsWith('@')) {
      readdirSync(path.join(nodeModulesDir, npmPackageOrScope)).forEach(p => {
        res.push(`${npmPackageOrScope}/${p}`);
      });
    } else {
      res.push(npmPackageOrScope);
    }
  });
  return res;
}

export function listFiles(dirName: string): string[] {
  // TODO use .gitignore to skip files
  if (dirName.indexOf('node_modules') > -1) return [];
  if (dirName.indexOf('dist') > -1) return [];

  const res = [dirName];
  // the try-catch here is intentional. It's only used in auto-completion.
  // If it doesn't work, we don't want the process to exit
  try {
    readdirSync(dirName).forEach(c => {
      const child = path.join(dirName, c);
      try {
        if (!statSync(child).isDirectory()) {
          res.push(child);
        } else if (statSync(child).isDirectory()) {
          res.push(...listFiles(child));
        }
      } catch (e) {}
    });
  } catch (e) {}
  return res;
}

export function directoryExists(filePath: string): boolean {
  try {
    return statSync(filePath).isDirectory();
  } catch (err) {
    return false;
  }
}

export function fileExistsSync(filePath: string): boolean {
  try {
    return statSync(filePath).isFile();
  } catch (err) {
    return false;
  }
}

export function readAndParseJson(fullFilePath: string): any {
  return JSON5.parse(readFileSync(fullFilePath).toString());
}

export function readAndCacheJsonFile(
  filePath: string,
  basedir: string
): { path: string; json: any } {
  const fullFilePath = path.join(basedir, filePath);

  if (fileContents[fullFilePath] || existsSync(fullFilePath)) {
    fileContents[fullFilePath] =
      fileContents[fullFilePath] || readAndParseJson(fullFilePath);

    return {
      path: fullFilePath,
      json: fileContents[fullFilePath]
    };
  } else {
    return {
      path: fullFilePath,
      json: {}
    };
  }
}

const registry = new schema.CoreSchemaRegistry(standardFormats);
export async function normalizeSchema(
  s: {
    properties: { [k: string]: any };
    required: string[];
  },
  projectDefaults?: SchematicDefaults
): Promise<Option[]> {
  const options = await parseJsonSchemaToOptions(registry, s);
  const requiredFields = new Set(s.required || []);

  options.forEach(option => {
    const workspaceDefault = projectDefaults && projectDefaults[option.name];

    if (workspaceDefault !== undefined) {
      option.default = workspaceDefault;
    }

    if (requiredFields.has(option.name)) {
      option.required = true;
    }
  });

  return options.sort((a, b) => {
    if (typeof a.positional === 'number' && typeof b.positional === 'number') {
      return a.positional - b.positional;
    }

    if (typeof a.positional === 'number') {
      return -1;
    } else if (typeof b.positional === 'number') {
      return 1;
    } else if (a.required) {
      if (b.required) {
        return a.name.localeCompare(b.name);
      }
      return -1;
    } else if (b.required) {
      return 1;
    } else if (IMPORTANT_FIELDS_SET.has(a.name)) {
      if (IMPORTANT_FIELDS_SET.has(b.name)) {
        return (
          IMPORTANT_FIELD_NAMES.indexOf(a.name) -
          IMPORTANT_FIELD_NAMES.indexOf(b.name)
        );
      }
      return -1;
    } else if (IMPORTANT_FIELDS_SET.has(b.name)) {
      return 1;
    } else {
      return a.name.localeCompare(b.name);
    }
  });
}

export function getPrimitiveValue(value: any) {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null
  ) {
    return value.toString();
  } else {
    return undefined;
  }
}

export function filterByName<T>(t: T[], args: { name?: string | null }): T[] {
  return args.name ? t.filter((s: any) => s.name === args.name) : t;
}

export function normalizePath(value: string): string {
  const firstPart = value.split('/')[0];
  if (!firstPart) return value;
  if (!firstPart.endsWith(':')) return value;
  return value
    .replace(new RegExp('/', 'g'), '\\')
    .split('\\')
    .filter(r => !!r)
    .join('\\');
}

export function seconds<T>(fn: Function): [number, T] {
  const start = process.hrtime();
  const result = fn();
  const end = process.hrtime(start);
  return [end[0], result];
}
