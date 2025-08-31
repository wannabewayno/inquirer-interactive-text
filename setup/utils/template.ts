/**
 * Replaces placeholders in a template string with provided values
 * @param text - The template string containing placeholders in the format {{placeholder}}
 * @param replacements - An object mapping placeholder names to their replacement values
 * @returns The template string with all placeholders replaced with their corresponding values
 * @example
 * template("Hello {{name}}!", { name: "World" }) // Returns "Hello World!"
 */
export default function template(text: string, replacements: Record<string, string>) {
  Object.entries(replacements).forEach(([placeholder, value]) => {
    text = text.replaceAll(`{{${placeholder}}}`, value);
  });

  return text;
}
