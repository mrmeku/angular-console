import { Schema } from '@angular-console/schema';
import { QuickPickItem } from 'vscode';

export class NgTaskFlagQuickPickItem implements QuickPickItem {
  constructor(
    readonly flagName: string,
    readonly detail: string,
    readonly schema: Schema,
    readonly label: string
  ) {}
}
