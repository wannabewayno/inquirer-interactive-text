<div align="center">
  <h1>inquirer-interactive-text</h1>
  <p>
    <a alt="NPM Version"><img src="https://img.shields.io/npm/v/inquirer-interactive-text?style=social&logo=npm" /></a>
    <a alt="NPM Downloads"><img src="https://img.shields.io/npm/dw/inquirer-interactive-text?style=social&logo=npm" /></a>
    <a alt="NPM Last Update"><img src="https://img.shields.io/npm/last-update/inquirer-interactive-text?style=social&logo=npm" /></a>
  </p>
    <p>
    <a alt="Libraries.io dependency status for GitHub repo"><img src="https://img.shields.io/librariesio/github/wannabewayno/inquirer-interactive-text?style=plastic" /></a>
    <a alt="GitHub Issues or Pull Requests"><img src="https://img.shields.io/github/issues/wannabewayno/inquirer-interactive-text?style=plastic&logo=github" /></a>
  </p>
</div>



## Installation

```bash
npm install inquirer-interactive-text
```

## Usage

### Basic Example
```typescript
import { interactiveText } from 'inquirer-interactive-text';

const result = await interactiveText({
  fields: [
    [
      { id: 'type', required: true, placeholder: 'feat|fix|docs...' },
      { id: 'scope', required: false, placeholder: 'optional scope' },
      { id: 'subject', required: true, placeholder: 'brief description' }
    ],
    [
      { id: 'body', required: false, multiline: true, placeholder: 'detailed description' }
    ]
  ],
  template: '{type}({scope}): {subject}\n\n{body}',
  initialValues: {
    type: '',
    scope: '',
    subject: '',
    body: ''
  }
});

console.log(result); // { type: 'feat', scope: 'ui', subject: 'add button', body: '...' }
```

### Function Template Example
```typescript
const result = await interactiveText({
  fields: [
    [
      { id: 'name', required: true, placeholder: 'Enter name' },
      { id: 'age', required: false, placeholder: 'Enter age' }
    ]
  ],
  template: (state, focused) => {
    const highlight = (text, isFocused) => 
      isFocused ? `**${text}**` : text;
    
    return `Name: ${highlight(state.name || '<name>', focused === 'name')}, Age: ${highlight(state.age || '<age>', focused === 'age')}`;
  }
});
```

## Features

- **2D Field Navigation**: Organize fields in a grid layout with intuitive arrow key navigation
- **Inline Editing**: Press 'e' to edit fields with placeholder text and real-time updates
- **Flexible Templates**: Use string interpolation or custom render functions
- **Framework Agnostic**: Build any structured text interface (forms, commit messages, etc.)
- **TypeScript Support**: Full type safety with generic field value types

## Navigation

- **Arrow Keys**: Navigate between fields (right/left within rows, up/down between rows)
- **'e' Key**: Enter edit mode for the current field
- **Enter**: Save changes (in edit mode) or submit form (in navigation mode)
- **Escape**: Cancel changes and exit edit mode

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT