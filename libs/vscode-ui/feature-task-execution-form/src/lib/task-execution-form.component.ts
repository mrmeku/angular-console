import {
  ChangeDetectionStrategy,
  Component,
  Inject,
  NgZone,
  OnInit,
  ChangeDetectorRef
} from '@angular/core';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { combineLatest, Observable, ReplaySubject } from 'rxjs';
import {
  distinctUntilChanged,
  map,
  shareReplay,
  startWith
} from 'rxjs/operators';

import {
  TASK_EXECUTION_SCHEMA,
  TaskExecutionSchema
} from './task-execution-form.schema';

declare global {
  interface Window {
    SET_TASK_EXECUTION_SCHEMA: (schema: TaskExecutionSchema) => void;
  }
}

@Component({
  selector: 'vscode-ui-task-execution-form',
  templateUrl: './task-execution-form.component.html',
  styleUrls: ['./task-execution-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskExecutionFormComponent implements OnInit {
  private readonly architectSubject = new ReplaySubject<TaskExecutionSchema>();

  readonly architect$ = this.architectSubject.asObservable();

  readonly taskExecForm$: Observable<FormGroup> = this.architect$.pipe(
    map(architect => this.buildForm(architect)),
    shareReplay()
  );

  readonly filterFieldsControl = new FormControl('');

  private readonly filterValue$ = (this.filterFieldsControl
    .valueChanges as Observable<string>).pipe(
    startWith(''),
    map(filterValue => filterValue.toLowerCase()),
    distinctUntilChanged()
  );

  readonly filteredFields$: Observable<{
    [key: string]: boolean;
  }> = combineLatest([
    this.architect$.pipe(
      map(architect => {
        return architect.schema.map(field => {
          return {
            fieldName: field.name,
            fieldNameLowerCase: field.name.toLowerCase()
          };
        });
      })
    ),
    this.filterValue$
  ]).pipe(
    map(([fields, filterValue]) => {
      const filteredFields: {
        [key: string]: boolean;
      } = {};
      fields.forEach(field => {
        filteredFields[field.fieldName] = field.fieldNameLowerCase.includes(
          filterValue
        );
      });

      return filteredFields;
    }),
    shareReplay()
  );

  constructor(
    private readonly fb: FormBuilder,
    @Inject(TASK_EXECUTION_SCHEMA) public initialSchema: TaskExecutionSchema,
    private readonly ngZone: NgZone,
    private readonly changeDetectorRef: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.architectSubject.next(this.initialSchema);

    window.SET_TASK_EXECUTION_SCHEMA = schema => {
      this.ngZone.run(() => {
        this.architectSubject.next(schema);
        setTimeout(() => {
          this.changeDetectorRef.detectChanges();
        }, 0);
      });
    };
  }

  buildForm(architect: TaskExecutionSchema): FormGroup {
    const taskExecForm = this.fb.group({});

    architect.schema.forEach(schema => {
      taskExecForm.addControl(
        schema.name,
        new FormControl(schema.defaultValue)
      );
    });

    return taskExecForm;
  }
}
