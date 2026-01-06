/**
 * Replace message variables with client data.
 * Supported variables:
 * - {firstname} - Client's first name (first word of full name)
 * - {name} - Client's full name
 *
 * Variables are case-insensitive.
 */
export function replaceVariables(
  content: string,
  client: { name?: string | null }
): string {
  const fullName = client.name || ''
  const firstName = fullName.split(' ')[0] || ''

  return content
    .replace(/\{firstname\}/gi, firstName)
    .replace(/\{name\}/gi, fullName)
}
