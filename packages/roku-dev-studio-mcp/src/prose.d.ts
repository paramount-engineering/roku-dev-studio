/**
 * Ambient module declaration so TypeScript treats `import body from './foo.md'`
 * as a string. The actual content is inlined at build time by esbuild's
 * `text` loader (see build.mjs). The MCP server runtime never reads `.md`
 * files from disk; everything ships baked into `dist/index.cjs`.
 */
declare module '*.md' {
  const content: string;
  export default content;
}
