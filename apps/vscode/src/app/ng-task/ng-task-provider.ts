import { readAndParseJson } from '@angular-console/server';
import { existsSync } from 'fs';
import { join } from 'path';
import {
  ProviderResult,
  Task,
  TaskExecution,
  TaskProvider,
  tasks,
  window
} from 'vscode';

import { getTelemetry } from '../telemetry';
import { NgTask } from './ng-task';
import {
  AngularJson,
  NamedProject,
  NgTaskDefinition,
  ProjectDef,
  Projects
} from './ng-task-definition';

export class NgTaskProvider implements TaskProvider {
  private workspacePath?: string;
  private currentDryRun?: TaskExecution;
  private deferredDryRun?: NgTaskDefinition;

  constructor() {
    tasks.onDidEndTaskProcess(e => {
      if (e.execution === this.currentDryRun) {
        this.currentDryRun = undefined;
      }
      if (this.deferredDryRun) {
        this.executeTask(this.deferredDryRun);
        this.deferredDryRun = undefined;
      }
    });
  }

  getWorkspacePath() {
    return this.workspacePath;
  }

  setWorkspacePath(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  provideTasks(): ProviderResult<Task[]> {
    return null;
  }

  resolveTask(task: Task): Task | undefined {
    if (
      this.workspacePath &&
      task.definition.command &&
      task.definition.project
    ) {
      const ngTask = this.createTask({
        command: task.definition.command,
        positional: task.definition.project,
        flags: Array.isArray(task.definition.flags) ? task.definition.flags : []
      });
      // resolveTask requires that the same definition object be used.
      ngTask.definition = task.definition;
      return ngTask;
    }
  }

  createTask(definition: NgTaskDefinition) {
    return NgTask.create(definition, this.workspacePath || '');
  }

  executeTask(definition: NgTaskDefinition) {
    if (
      !this.workspacePath ||
      !existsSync(join(this.workspacePath, 'node_modules'))
    ) {
      window.showErrorMessage(
        'Could not execute task since node_modules directory is missing. Run npm install.'
      );
      return;
    }

    const isDryRun = definition.flags.includes('--dry-run');
    if (isDryRun && this.currentDryRun) {
      this.deferredDryRun = definition;
      return;
    }

    const task = this.createTask(definition);

    const telemetry = getTelemetry();
    telemetry.featureUsed(definition.command);

    return tasks.executeTask(task).then(execution => {
      if (isDryRun) {
        this.currentDryRun = execution;
      }
    });
  }

  getProjects(): Projects {
    if (!this.workspacePath) {
      return {};
    }

    try {
      const { projects } = readAndParseJson(
        join(this.workspacePath, 'angular.json')
      ).json as AngularJson;

      return projects;
    } catch (e) {
      return {};
    }
  }

  getProjectNames(): string[] {
    return Object.keys(this.getProjects() || {});
  }

  getProjectEntries(): [string, ProjectDef][] {
    return Object.entries(this.getProjects() || {}) as [string, ProjectDef][];
  }

  projectForPath(selectedPath: string): NamedProject | null {
    if (!this.workspacePath) return null;

    const entry = this.getProjectEntries().find(([_, def]) =>
      selectedPath.startsWith(join(this.workspacePath!, def.root))
    );

    return entry ? { name: entry[0], ...entry[1] } : null;
  }
}
