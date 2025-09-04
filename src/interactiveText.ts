import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { createPrompt, type KeypressEvent, type Theme, useEffect, useKeypress, useMemo, useState } from '@inquirer/core';
import type { PartialDeep } from '@inquirer/type';
import { cursorHide } from 'ansi-escapes';
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

export type CustomAction = (hooks: Controls) => void | Promise<void>;

export interface EditActionConfig {
  scope: 'edit';
  name: string;
  key: string;
  displayKey?: string;
  action: ((hooks: Controls) => void) | 'save' | 'cancel';
  label?: string;
}

export interface NavigateActionConfig {
  scope: 'navigate';
  name: string;
  key: string;
  displayKey?: string;
  action: ((hooks: Controls) => void) | 'done' | 'remove' | 'edit';
  label?: string;
}

export type ActionConfig = NavigateActionConfig | EditActionConfig;

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
  actions?: ActionConfig[];
  theme?: PartialDeep<Theme>;
}

function getFlatFields(fieldGrid: FieldGrid): Field[] {
  return fieldGrid.flat();
}

function getFieldAtPosition(fieldGrid: FieldGrid, position: Position): Field | undefined {
  return fieldGrid[position.row]?.[position.col];
}

// function validateFields(state: State, fields: FieldGrid): null | Record<string, string> {
//   const errors = getFlatFields(fields).reduce(
//     (errors, { id, validator, required }) => {
//       const value = state[id];
//       if (value) {
//         if (validator) {
//           const error = validator(value);
//           if (error) errors[id] = error;
//         }
//       } else if (required) {
//         errors[id] = `${id} is required`;
//       }

//       return errors;
//     },
//     {} as Record<string, string>,
//   );

//   return Object.keys(errors).length ? errors : null;
// }

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

function validate(currentLine: string, { setErrors, setEditValue, errors, currentField }: Controls) {
  const { transformer, validator, id } = currentField ?? {};
  const transformedValue = transformer ? transformer(currentLine) : currentLine;

  const error = validator ? validator(transformedValue) : null;
  if (!error) {
    const { [id ?? '']: _, ...otherErrors } = errors;
    setErrors(otherErrors);
  } else {
    setErrors({ ...errors, [id ?? '']: error });
  }

  setEditValue(transformedValue);
}

export type KeyPressEvent = KeypressEvent & { shift: boolean; meta: boolean };

const actionMap: Record<Extract<ActionConfig['action'], string>, CustomAction> = {
  edit: ({ currentField, setEditMode, setEditValue, state }) => {
    if (!currentField) return;
    setEditMode(true);
    setEditValue(state[currentField.id] || '');
    // rl.write(state[currentField.id] || '');
  },
  remove: ({ currentField, setState, state }) => {
    if (!currentField) return;
    const { [currentField.id]: _, ...values } = state;
    setState({ ...values });
  },
  done: ({ setErrors, done, errors }) => {
    // const errors = validateFields(state, config.fields);
    if (!errors) return done();
    setErrors(errors);
  },
  cancel: ({ setEditMode, setEditValue }) => {
    // Cancel edit mode and wipe current edit value
    setEditMode(false);
    setEditValue('');
  },
  save: ({ errors, currentField, setEditMode, setEditValue, editValue, state, setState }) => {
    // Don't allow saving if there's no field or errors on the current field.
    if (!currentField || errors[currentField.id]) return;
    setState({ ...state, [currentField.id]: editValue });
    setEditMode(false);
    setEditValue('');
  },
};

class Action {
  readonly label: string;
  readonly action: CustomAction;
  readonly keyCombination: string;

  constructor(
    public readonly scope: 'edit' | 'navigate',
    public readonly name: string,
    action: Extract<ActionConfig['action'], string> | CustomAction,
    key: string,
    label?: string,
  ) {
    this.keyCombination = key.replace(/\s/g, '').toLowerCase().replace(/enter/, 'return');

    this.label =
      label ??
      `(${this.keyCombination
        .split('+')
        .map(v => v.replace(/^\w/, v => v.toUpperCase()))
        .join('+')
        .replace(/Return/, 'Enter')})`;

    this.action = typeof action === 'string' ? actionMap[action] : action;
  }

  isTriggered(key: KeyPressEvent) {
    const keys = [key.name.toLowerCase()];
    if (key.ctrl) keys.unshift('ctrl');
    if (key.shift) keys.unshift('shift');
    if (key.meta) keys.unshift('alt');

    return this.keyCombination === keys.join('+');
  }

  toString() {
    return `${this.name} ${this.label}`;
  }

  trigger(controls: Controls) {
    return this.action(controls);
  }
}

interface Controls {
  state: State;
  setState: (newState: Record<string, string>) => void;
  errors: Record<string, string>;
  setErrors: (newErrors: Record<string, string>) => void;
  editMode: boolean;
  setEditMode: (newEditMode: boolean) => void;
  editValue: string;
  setEditValue: (newValue: string) => void;
  position: Position;
  setPosition: (newPosition: Position) => void;
  currentField?: Field;
  setCurrentField: (id: string) => void;
  done: () => void;
}

function log(...text: string[]) {
  appendFile(path.resolve('./log.txt'), text.join('\n'));
}

function parseActions(actionConfigs: ActionConfig[] = []): { editActions: Action[]; navigationActions: Action[] } {
  const actions = actionConfigs.map(({ scope, name, action, key, label }) => new Action(scope, name, action, key, label));

  // Go through users actions and ensure we have all the required actions in there, otherwise add in the defaults
  if (!actionConfigs.some(a => a.action === 'done')) actions.push(new Action('navigate', 'Done', 'done', 'alt+enter'));
  if (!actionConfigs.some(a => a.action === 'edit')) actions.push(new Action('navigate', 'Edit', 'edit', 'enter'));
  if (!actionConfigs.some(a => a.action === 'remove'))
    actions.push(new Action('navigate', 'Remove', 'remove', 'delete', '(Del)'));
  if (!actionConfigs.some(a => a.action === 'cancel'))
    actions.push(new Action('edit', 'Cancel', 'cancel', 'escape', '(Esc)'));
  if (!actionConfigs.some(a => a.action === 'save')) actions.push(new Action('edit', 'Save', 'save', 'enter'));

  const editActions: Action[] = actions.filter(({ scope }) => scope === 'edit');
  const navigationActions: Action[] = actions.filter(({ scope }) => scope === 'navigate');

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
    log('[parseActions] useMemo');
    return parseActions(config.actions);
  }, [config.actions]);

  const fields = useMemo(() => {
    log('[fields] useMemo');
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
    log('[renderer] useMemo');
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
    ============ Caching Layer ====================
  */

  const errorString = useMemo(() => {
    const errorMessage = Object.entries(errors)
      .reduce((msg, [field, err]) => msg.concat(`- [${field}] ${err}`), [] as string[])
      .join('\n');
    return errorMessage !== '' ? `\n\n${red(errorMessage)}` : errorMessage;
  }, [errors]);

  const actionString = useMemo(() => {
    return editMode ? editActions.map(v => v.toString()).join(' | ') : navigationActions.map(v => v.toString()).join(' | ');
  }, [editMode, editActions, navigationActions]);

  /*
    ============ Logic Layer ====================
  */
  const controls = {
    state: values,
    setState: setValues,
    errors,
    setErrors,
    editMode,
    setEditMode,
    editValue,
    setEditValue,
    position,
    setPosition,
    currentField,
    setCurrentField: (id: string) => {
      let rowIndex = 0;
      let columnIndex = 0;

      for (const row of config.fields) {
        columnIndex = row.findIndex(field => field.id === id);
        if (columnIndex > -1) break;
        rowIndex++;
      }

      setPosition({ row: rowIndex, col: columnIndex });
    },
    done: () => done(values),
  };

  useKeypress((key, rl) => {
    if (editMode) {
      const action = editActions.find(action => action.isTriggered(key as KeyPressEvent));

      if (action) action.trigger(controls);

      validate(rl.line, controls);
    } else {
      // These should be actions also.
      if (['up', 'down', 'left', 'right'].includes(key.name)) {
        return setPosition(navigatePosition(config.fields, position, key.name as Direction));
      }

      const action = navigationActions.find(action => action.isTriggered(key as KeyPressEvent));

      if (action) action.trigger(controls);
    }
  });

  // Clear the line ready for input when the edit mode changes
  useEffect(
    rl => {
      rl.clearLine(0);
    },
    [editMode],
  );

  /*
    ============ Rendering Layer ====================
  */
  const displayState = editMode && currentField ? { ...values, [currentField.id]: editValue } : values;

  const rendered = renderer(displayState, editMode, Object.keys(errors), currentField?.id);

  const text = `${actionString}\n\n${rendered}${errorString}`;

  if (editMode) return text;
  return `${text}${cursorHide}`;
});
