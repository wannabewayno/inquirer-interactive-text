import { gray, green, italic } from 'yoctocolors';
import { interactiveText } from './index.js';

// Example usage - commit message builder
const commitExample = async () => {
  const result = await interactiveText({
    fields: [
      [
        { id: 'type', required: true, placeholder: 'feat|fix|docs...' },
        { id: 'scope', required: false, placeholder: 'optional scope' },
        { id: 'subject', required: true, placeholder: 'brief description' },
      ],
      [{ id: 'body', required: false, multiline: true, placeholder: 'detailed description' }],
    ],
    renderer: {
      template: '{type}({scope}): {subject}\n\n{body}',
    },
    initialValues: {
      type: '',
      scope: '',
      subject: '',
      body: '',
    },
  });

  console.log('Result:', result);
};

const highlight = (text: string, isEdit: boolean, isFocused: boolean) => {
  if (isEdit && isFocused) return italic(gray(text));
  if (isFocused) return green(text);
  return text;
};

// Example with function template
const functionTemplateExample = async () => {
  const result = await interactiveText({
    fields: [
      [
        { id: 'name', required: true, placeholder: 'Enter name' },
        { id: 'age', required: false, placeholder: 'Enter age' },
      ],
    ],
    renderer: (state, isEdit, _errors, focused) => {
      return `Name: ${highlight(state['name'] || 'name', isEdit, focused === 'name')}, Age: ${highlight(state['age'] || 'age', isEdit, focused === 'age')}`;
    },
  });

  console.log('Result:', result);
};

export { commitExample, functionTemplateExample };
