/**
 * Output-schema check for op responses at the MCP tool boundary.
 *
 * Why this exists:
 *   - The OWASP "Practical Guide for Secure MCP Server Development" §3
 *     ("Strict Input/Output Validation") asks for response-shape
 *     validation at the server boundary. Today every op declares an
 *     `outputSchema` in `roku-dev-studio-api/lib/operations.ts`; this
 *     validator matches a response against that schema and surfaces
 *     mismatches without breaking the call.
 *
 * Mode:
 *   - **Warn-only.** Mismatches are logged to stderr with the op id +
 *     the path of the offending field; the response still flows back to
 *     the agent unchanged. This lets us tighten schemas in the descriptor
 *     and catch regressions on the next test run before flipping the
 *     check to reject in a future release.
 *
 * Coverage (subset of JSON Schema we actually use in op descriptors):
 *   - `type`: object | array | string | number | boolean
 *   - `properties` + `required` + `additionalProperties` for objects
 *   - `items` for arrays (single-type case)
 *   - `enum` for primitive constants
 *
 * Intentionally NOT covered (not used by any current op outputSchema):
 *   - `oneOf` / `anyOf` / `allOf`
 *   - `pattern` / `format` / `minLength` / `maxLength`
 *   - `$ref` / `definitions`
 *   - tuple-form `items: [schema, schema, ...]`
 *
 * If a future schema needs richer rules, switch this implementation to
 * Ajv (already in the lockfile via electron-builder); the public surface
 * (`validateOutput`) won't change.
 */

type JsonSchemaType = 'string' | 'number' | 'boolean' | 'object' | 'array';

type Schema = {
  type?: JsonSchemaType | JsonSchemaType[];
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: boolean | Schema;
  items?: Schema;
  enum?: ReadonlyArray<string | number | boolean>;
};

export type OutputSchemaIssue = {
  /** JSON-pointer-ish path to the offending value (e.g. `success` or `lines[0].text`). */
  path: string;
  /** Stable machine code (`type_mismatch`, `missing_required`, `extra_property`, …). */
  code: string;
  /** Human-readable detail. */
  message: string;
};

function describeRuntimeType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function matchesType(value: unknown, t: JsonSchemaType): boolean {
  switch (t) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'object':
      return value !== null && typeof value === 'object' && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
  }
}

function joinPath(parent: string, key: string | number): string {
  if (typeof key === 'number') return `${parent}[${key}]`;
  if (parent === '') return key;
  return `${parent}.${key}`;
}

function validate(value: unknown, schema: Schema | undefined, path: string, issues: OutputSchemaIssue[]): void {
  if (!schema) return;

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => matchesType(value, t))) {
      issues.push({
        path: path || '<root>',
        code: 'type_mismatch',
        message: `expected ${types.join('|')}, got ${describeRuntimeType(value)}`
      });
      return; // No point recursing into the wrong shape.
    }
  }

  if (schema.enum && schema.enum.length > 0) {
    if (!schema.enum.some((v) => v === value)) {
      issues.push({
        path: path || '<root>',
        code: 'enum_mismatch',
        message: `expected one of ${JSON.stringify(schema.enum)}, got ${JSON.stringify(value)}`
      });
    }
  }

  if (schema.type === 'object' || (Array.isArray(schema.type) && schema.type.includes('object'))) {
    if (matchesType(value, 'object')) {
      const obj = value as Record<string, unknown>;
      for (const k of schema.required || []) {
        if (!(k in obj)) {
          issues.push({
            path: joinPath(path, k),
            code: 'missing_required',
            message: `required property "${k}" is missing`
          });
        }
      }
      const props = schema.properties || {};
      for (const [k, v] of Object.entries(obj)) {
        if (k in props) {
          validate(v, props[k], joinPath(path, k), issues);
        } else if (schema.additionalProperties === false) {
          issues.push({
            path: joinPath(path, k),
            code: 'extra_property',
            message: `property "${k}" is not declared in schema (additionalProperties=false)`
          });
        } else if (typeof schema.additionalProperties === 'object') {
          validate(v, schema.additionalProperties, joinPath(path, k), issues);
        }
        // additionalProperties is true (or undefined) → permissive, no recursion.
      }
    }
  }

  if (schema.type === 'array' || (Array.isArray(schema.type) && schema.type.includes('array'))) {
    if (matchesType(value, 'array') && schema.items) {
      const arr = value as unknown[];
      for (let i = 0; i < arr.length; i++) {
        validate(arr[i], schema.items, joinPath(path, i), issues);
      }
    }
  }
}

/**
 * Validate `body` against `schema`. Returns issues; empty array = clean.
 * The caller decides whether to log, reject, or carry on (today: log only).
 */
export function validateOutput(body: unknown, schema: Schema): OutputSchemaIssue[] {
  const issues: OutputSchemaIssue[] = [];
  validate(body, schema, '', issues);
  return issues;
}

/**
 * Stderr report helper. The MCP server reserves stdout for protocol
 * traffic, so all diagnostics go to stderr. The host (Cursor / Claude)
 * surfaces them in its diagnostic pane.
 */
export function logOutputSchemaIssues(opId: string, issues: OutputSchemaIssue[]): void {
  if (issues.length === 0) return;
  // Cap the issue list per call so a runaway schema mismatch can't
  // flood the host log.
  const sample = issues.slice(0, 5);
  for (const issue of sample) {
    // eslint-disable-next-line no-console
    console.error(
      `[output-schema] ${opId}: ${issue.path} — ${issue.code}: ${issue.message}`
    );
  }
  if (issues.length > sample.length) {
    // eslint-disable-next-line no-console
    console.error(`[output-schema] ${opId}: …and ${issues.length - sample.length} more issue(s)`);
  }
}
