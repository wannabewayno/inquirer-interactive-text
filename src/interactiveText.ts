import { createPrompt, KeypressEvent, type Theme, useKeypress, useMemo, useState } from '@inquirer/core';
import type { PartialDeep } from '@inquirer/type';
import { cursorHide } from 'ansi-escapes';
import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import {
  black,
  blue,
  bold,
  cyan,
  dim,
  gray,
  green,
  italic,
  magenta,
  red,
  strikethrough,
  underline,
  white,
  yellow,
} from 'yoctocolors';

const styles = {
  red,
  green,
  yellow,
  blue,
  gray,
  italic,
  bold,
  black,
  white,
  magenta,
  cyan,
  dim,
  underline,
  strikethrough,
};

type State = Record<string, string>;
export interface Field<T = string> {
  id: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: T;
  validator?: (value: T) => undefined | null | string;
  transformer?: (value: T) => T;
  multiline?: boolean;
}

export interface Position {
  row: number;
  col: number;
}

export type CustomAction = (hooks: StateManipulations) => void | Promise<void>;

export interface EditActionConfig {
  scope: 'edit';
  name: string;
  key: string;
  displayKey?: string;
  action: ((hooks: StateManipulations) => void) | 'save' | 'cancel'
  label?: string;
}

export interface NavigateActionConfig {
  scope: 'navigate';
  name: string;
  key: string;
  displayKey?: string;
  action: ((hooks: StateManipulations) => void) | 'done' | 'remove' | 'edit'
  label?: string;
}

export type ActionConfig = NavigateActionConfig | EditActionConfig

export type Style = keyof typeof styles;
export type StyleConfig = Style | Style[] | ((value: string) => string);

export interface RendererOpts {
  template: string;
  errorStyle?: StyleConfig;
  selectedStyle?: StyleConfig;
  editingStyle?: StyleConfig;
}

export type Renderer<T> =
  | RendererOpts
  | ((state: T, editMode: boolean, errorFields: string[], focusedField?: string) => string);

export type FieldGrid = Field[][];

export interface InteractiveTextConfig<T = State> {
  fields: FieldGrid;
  renderer: Renderer<T>;
  initialValues?: Partial<T>;
  actions?: (ActionConfig)[];
  theme?: PartialDeep<Theme>;
}

function getFlatFields(fieldGrid: FieldGrid): Field[] {
  return fieldGrid.flat();
}

function getFieldAtPosition(fieldGrid: FieldGrid, position: Position): Field | undefined {
  return fieldGrid[position.row]?.[position.col];
}

function validateFields(state: State, fields: FieldGrid): null | Record<string, string> {
  const errors = getFlatFields(fields).reduce(
    (errors, { id, validator, required }) => {
      const value = state[id];
      if (value) {
        if (validator) {
          const error = validator(value);
          if (error) errors[id] = error;
        }
      } else if (required) {
        errors[id] = `${id} is required`;
      }

      return errors;
    },
    {} as Record<string, string>,
  );

  return Object.keys(errors).length ? errors : null;
}

const toActionString = (action: ActionConfig) => `(${action.displayKey}) ${action.label}`;

type Direction = 'up' | 'down' | 'left' | 'right';
function navigatePosition(fieldGrid: FieldGrid, current: Position, direction: Direction): Position {
  const { row, col } = current;

  switch (direction) {
    case 'right': {
      const currentRow = fieldGrid[row];
      if (!currentRow) return current;
      const nextCol = (col + 1) % currentRow.length;
      return { row, col: nextCol };
    }
    case 'left': {
      const currentRow = fieldGrid[row];
      if (!currentRow) return current;
      const prevCol = col === 0 ? currentRow.length - 1 : col - 1;
      return { row, col: prevCol };
    }
    case 'down': {
      const nextRow = (row + 1) % fieldGrid.length;
      const targetRow = fieldGrid[nextRow];
      if (!targetRow) return current;
      const targetCol = Math.min(col, targetRow.length - 1);
      return { row: nextRow, col: targetCol };
    }
    case 'up': {
      const prevRow = row === 0 ? fieldGrid.length - 1 : row - 1;
      const targetRow = fieldGrid[prevRow];
      if (!targetRow) return current;
      const targetCol = Math.min(col, targetRow.length - 1);
      return { row: prevRow, col: targetCol };
    }
  }
}

export type KeyPressEvent = KeypressEvent & { shift: boolean, meta: boolean }

class Action {
  keyCombination: string;
  constructor(public readonly scope: 'edit' | 'navigate', public readonly name: string, public readonly action: CustomAction, key: string, public readonly label?: string) {
    this.keyCombination = key.replace(/\s/g, '').toLowerCase().replace(/enter/, 'return');
    if (!label) this.label = `(${this.keyCombination.split('+').map(v => v.replace(/^\w/,v => v.toUpperCase())).join('+').replace(/Return/, 'Enter')})`;
  }

  private isTriggered(key: KeyPressEvent) {
    const keys = [key.name.toLowerCase()];
    if (key.ctrl) keys.unshift('ctrl');
    if (key.shift) keys.unshift('shift');
    if (key.meta)  keys.unshift('alt');

    return this.keyCombination === keys.join('+');
  }

  toString() {
    return `${this.name} ${this.label}`
  }

  trigger(key: KeyPressEvent, controls: Controls) {
    if (!this.isTriggered(key)) return;
    // give the action the thing.
    return this.action(controls);
  }
}

interface Controls {
  setErrors: (currentErrors: Record<string, string>) => Record<string, string>;
  setEditMode: (currentEditMode: boolean) => boolean;
  setEditValue: (currentValue: string) => string;
  setPosition: (currentPosition: { row: 0, column: 0 }) =>  { row: 0, column: 0 };
  setFocus: (currentFocus: string) => string;
  getFocus: (currentFocus: string) => string;
  setState: (currentState: Record<string, string>) => Record<string, string>;

}

function log(...text: string[]) {
  appendFile(path.resolve('./log.txt'), text.join('\n'))
}

  const editAction: ActionConfig = { key: 'enter', action: () => {}, name: 'Edit', scope: 'navigate' };
  const removeAction: ActionConfig = { key: 'delete', action: () => {}, name: 'Remove', label: '(Del)', scope: 'navigate' };
  const doneAction: ActionConfig = { key: 'alt+enter', action: () => {}, name: 'Done', scope: 'navigate' };
  const cancelAction: ActionConfig = { key: 'escape', action: () => {}, name: 'Cancel', label: '(Esc)', scope: 'edit' };
  const saveAction: ActionConfig = { key: 'enter', action: () => {}, name: 'Save', scope: 'edit' };

function parseActions(actions?: ActionConfig[]): { editActions: Action[]; navigationActions: Action[] } {
  if (!actions) actions = [];

  const defaultEditAction: ActionConfig = { key: 'enter', action: () => {}, name: 'Edit', scope: 'navigate' };
  const defaultRemoveAction: ActionConfig = { key: 'delete', action: () => {}, name: 'Remove', label: '(Del)', scope: 'navigate' };
  const defaultDoneAction: ActionConfig = { key: 'alt+enter', action: () => {}, name: 'Done', scope: 'navigate' };
  const defaultCancelAction: ActionConfig = { key: 'escape', action: () => {}, name: 'Cancel', label: '(Esc)', scope: 'edit' };
  const defaultSaveAction: ActionConfig = { key: 'enter', action: () => {}, name: 'Save', scope: 'edit' };

  // Go through users actions and ensure we have all the required actions in there, otherwise add in the defaults
  if (!actions.find(a => a.action === 'save')) actions.push(defaultSaveAction);
  if (!actions.find(a => a.action === 'edit')) actions.push(defaultEditAction);
  if (!actions.find(a => a.action === 'remove')) actions.push(defaultRemoveAction);
  if (!actions.find(a => a.action === 'cancel')) actions.push(defaultCancelAction);
  if (!actions.find(a => a.action === 'done')) actions.push(defaultDoneAction);

  const editActions: Action[] = actions.filter(({ scope }) => scope === 'edit').map(({ scope, name, action, key, label }) => new Action(scope, name, action, key, label));
  const navigationActions: Action[] = actions.filter(({ scope }) => scope === 'navigate').map(({ scope, name, action, key, label }) => new Action(scope, name, action, key, label));

  return { editActions, navigationActions };
}

const defaultErrorStyle: StyleConfig = ['italic', 'red'];
const defaultEditingStyle: StyleConfig = ['italic', 'gray'];
const defaultSelectedStyle: StyleConfig = 'blue';

function parseStyle(style: StyleConfig): (value: string) => string {
  if (typeof style === 'function') return style;
  const styleStrings = Array.isArray(style) ? style : [style];

  return (value: string) => styleStrings.reduce((value, style: Style) => styles[style](value), value);
}

// There should be a styling function that's different when editing.

export default createPrompt<State, InteractiveTextConfig>((config, done) => {
  /*
    ============ CONFIGURATION PARSING ====================
  */
  const { editActions, navigationActions } = useMemo(() => {
    log('[parseActions] useMemo')
    return parseActions(config.actions)
  }, [config.actions]);

  const fields = useMemo(() => {
    log('[fields] useMemo')
    return Object.fromEntries(
      config.fields.flat().map(field => {
        // Set defaults whilst we're here
        if (!field.placeholder) field.placeholder = field.required ? `<${field.id}>` : `${field.id}?`;

        return [field.id, field];
      }),
    );
  }, [config.fields]);

  // Setup the renderer
  const renderer = useMemo(() => {
    log('[renderer] useMemo')
    if (typeof config.renderer === 'function') return config.renderer;

    const { template, editingStyle, selectedStyle, errorStyle } = config.renderer;
    const editingStyleFn = parseStyle(editingStyle ?? defaultEditingStyle);
    const selectedStyleFn = parseStyle(selectedStyle ?? defaultSelectedStyle);
    const errorStyleFn = parseStyle(errorStyle ?? defaultErrorStyle);

    return (state: State, isEdit: boolean, errorFields: string[], focusedField?: string) =>
      template.replace(/{(\w+)}/g, match => {
        const field = match.slice(1, -1);
        const isFocused = field === focusedField;

        const fieldConfig = fields[field];

        const value = state[field];
        const valueStr = !value ? (fieldConfig?.placeholder ?? field) : String(value);

        if (isEdit && isFocused && errorFields.includes(field)) return errorStyleFn(valueStr);
        if (isEdit && isFocused) return editingStyleFn(valueStr);
        if (isFocused) return selectedStyleFn(valueStr);
        return valueStr;
      });
  }, [config.renderer, fields]);

  /*
    ============ State + Actions ====================
  */

  const [values, setValues] = useState<State>(() => {
    const initial: State = {};
    getFlatFields(config.fields).forEach(field => {
      initial[field.id] = config.initialValues?.[field.id] ?? field.defaultValue ?? '';
    });
    return initial;
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [position, setPosition] = useState<Position>({ row: 0, col: 0 });
  const [editMode, setEditMode] = useState(false);
  const [editValue, setEditValue] = useState('');

  const currentField = useMemo(() => {
    return getFieldAtPosition(config.fields, position);
  }, [config.fields, position]);

  /*
    ============ Logic Layer ====================
  */

  useKeypress((key, rl) => {
    if (editMode) {
      const action = editActions.find(action => action.key === key.name);

      if (action) {
        switch (action.action) {
          case 'cancel':
            setEditMode(false);
            setEditValue('');
            break;
          case 'save':
            if (currentField) setValues({ ...values, [currentField.id]: editValue });
            setEditMode(false);
            setEditValue('');
            break;
        }
      }

      const { transformer, validator, id } = currentField ?? {};
      const transformedValue = transformer ? transformer(rl.line) : rl.line;

      const error = validator ? validator(transformedValue) : null;
      if (!error) {
        const { [id ?? '']: _, ...otherErrors } = errors;
        setErrors(otherErrors);
      } else {
        setErrors({ ...errors, [id ?? '']: error });
      }

      setEditValue(transformedValue);
    } else {
      if (['up', 'down', 'left', 'right'].includes(key.name)) {
        return setPosition(navigatePosition(config.fields, position, key.name as Direction));
      }

      const action = navigationActions.find(action => action.key === key.name);

      if (action) {
        switch (action.action) {
          case 'edit':
            if (currentField) {
              setEditMode(true);
              setEditValue(values[currentField.id] || '');
              rl.clearLine(-1);
              rl.write(values[currentField.id] || '');
            }
            break;
          case 'remove':
            if (currentField) setValues({ ...values, [currentField.id]: '' });
            break;
          case 'done': {
            const errors = validateFields(values, config.fields);
            if (!errors) return done(values);
            setErrors(errors);
            break;
          }
        }
      }
    }
  });

  /*
    ============ Rendering Layer ====================
  */

  const displayState = editMode && currentField ? { ...values, [currentField.id]: editValue } : values;

  const actionString = useMemo(() => {
    return editMode ? editActions.map(toActionString).join(' | ') : navigationActions.map(toActionString).join(' | ');
  }, [editMode, editActions, navigationActions]);

  const rendered = renderer(displayState, editMode, Object.keys(errors), currentField?.id);

  const errorString = useMemo(() => {
    const errorMessage = Object.entries(errors)
      .reduce((msg, [field, err]) => msg.concat(`- [${field}] ${err}`), [] as string[])
      .join('\n');
    return errorMessage !== '' ? `\n\n${red(errorMessage)}` : errorMessage;
  }, [errors]);

  const text = `${actionString}\n\n${rendered}${errorString}`;

  if (editMode) return text;
  return `${text}${cursorHide}`;
});
