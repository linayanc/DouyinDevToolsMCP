import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { ToolError } from './errors.js';

export async function validateProject(input: string, allowedRoots: string[]): Promise<string> {
  if (!path.isAbsolute(input)) throw new ToolError('PROJECT_INVALID', 'projectPath must be an absolute path.');
  let project: string;
  try {
    project = await realpath(input);
    if (!(await stat(project)).isDirectory()) throw new Error('Not a directory');
  } catch { throw new ToolError('PROJECT_NOT_FOUND', 'The project directory does not exist.'); }
  if (allowedRoots.length) {
    const roots = await Promise.all(allowedRoots.map(root => realpath(root)));
    if (!roots.some(root => {
      const relative = path.relative(root, project);
      return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
    })) throw new ToolError('PROJECT_NOT_ALLOWED', 'Project is outside DOUYIN_ALLOWED_ROOTS (symlinks are resolved).');
  }
  try {
    const file = path.join(project, 'project.config.json');
    if ((await stat(file)).size > 1024 * 1024) throw new Error('Config too large');
    const config = JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
    if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Expected object');
    if (config.compileType && !['game', 'microgame'].includes(config.compileType)) throw new Error('Not a mini game');
  } catch {
    throw new ToolError('PROJECT_INVALID', 'Expected a mini-game project.config.json in the project directory.',
      'For Unity, select the exported Douyin mini-game directory, not the Unity source project.');
  }
  return project;
}
