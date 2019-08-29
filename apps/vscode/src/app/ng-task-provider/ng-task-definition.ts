export interface NgTaskDefinition {
  type: 'shell';
  projectName: string;
  architectName: string;
  configuration?: string;
}

export interface ArchitectDef {
  configurations?: {
    [configuration: string]: {};
  };
}

export interface ProjectDef {
  root: string;
  architect?: {
    [architectName: string]: ArchitectDef;
  };
}

export interface Projects {
  [projectName: string]: ProjectDef | undefined;
}

export interface AngularJson {
  projects: Projects;
}

export function getArchitectTaskDefintions(
  defaultTaskDefinition: NgTaskDefinition,
  architectDef: ArchitectDef
) {
  return [
    defaultTaskDefinition,
    ...Object.keys(architectDef.configurations || {}).map(
      (configuration): NgTaskDefinition => ({
        ...defaultTaskDefinition,
        configuration
      })
    )
  ];
}
