/**
 * UI strings for the Static Channel Analysis window
 * (renderer/components/static-analysis/static-analysis.ts).
 *
 * This window wraps Roku's own `sca-cmd` CLI — RDS never ships that tool, only fetches it at
 * runtime (see main/static-analysis/sca-tool-manager.ts). Category tokens (`uncategorized`,
 * `raf`, `red`, …) are Roku's own CLI vocabulary and intentionally live in code, not here — only
 * their display labels are catalogued.
 *
 * Parametrized strings are functions returning the composed text — the standard way to keep
 * interpolation translatable without a runtime format library.
 */
export const staticAnalysis = {
  // Window shell
  windowTitle: 'Static Channel Analysis',
  heading: 'Static Channel Analysis',
  subtitle: "Run Roku's Static Channel Analysis tool on your Channel.",

  // Tool status badge (header)
  toolStatusChecking: 'Checking for updates…',
  toolStatusDownloading: 'Downloading analysis tool…',
  toolStatusReady: 'Analysis Tooling ready',
  toolStatusReadyUpdated: 'Analysis tool updated',
  toolStatusError: (message: string): string => `Couldn't prepare the analysis tool: ${message}`,
  retryBtn: 'Retry',
  toolInfoBtnTitle: 'About the Analysis Tool',
  toolInfoModalTitle: 'About the Analysis Tool',
  // `...Html` = rendered via `data-i18n-html` (innerHTML), not `data-i18n` (textContent) — the
  // inline `sca-cmd` code-style span can't survive a single-text-node replacement.
  toolInfoModalBodyHtml:
    'Static analysis runs Roku\'s own <code class="sca-inline-code">sca-cmd</code> command-line tool against your ' +
    'packaged channel to catch certification-style issues — deprecated APIs, manifest problems, ad-framework ' +
    "integration, and more — before you submit to the Channel Store. Roku Dev Studio doesn't ship this tool; " +
    "it's downloaded from Roku the first time you open this window, and re-checked for updates every time you " +
    'open it again.',

  // Java status badge (header)
  javaChecking: 'Checking Java…',
  javaVersionLabel: (version: string): string => `Java ${version}`,
  javaAvailable: (version: string): string => (version ? `Java detected (${version})` : 'Java detected'),
  javaMissing: 'Java Not Found',
  installJavaLink: 'Get Java',
  javaInfoBtnTitle: 'About the Java Requirement',
  javaInfoModalTitle: 'About the Java Requirement',
  javaInfoModalBodyHtml:
    '<code class="sca-inline-code">sca-cmd</code> is a Java program and needs a Java 21 or newer runtime ' +
    'installed on this machine to run. Roku Dev Studio only detects Java — it never installs or updates it for you.',
  javaInfoRequiredLabel: 'Required',
  javaInfoRequiredValue: 'Java 21 or newer',
  javaInfoDetectedLabel: 'Detected',

  // Channel file picker
  channelFileHeading: 'Channel File',
  chooseFileBtn: 'Choose Channel File…',
  clearFileTitle: 'Clear Selected File',
  dropzoneLabel: 'Or drag a .zip file here',
  chooseFileDialogTitle: 'Choose a Channel .zip',
  filterChannelZip: 'Channel zip',

  // Options
  optionsHeading: 'Options',
  severityLabel: 'Severity',
  severityInfo: 'Info',
  severityWarning: 'Warning',
  severityError: 'Error',
  categoriesLabel: 'Categories',
  categoryUncategorized: 'Uncategorized',
  categoryUncategorizedDesc: "Issues that don't fall under any of the other categories.",
  categoryDeprecatedComponents: 'Deprecated Components',
  categoryDeprecatedComponentsDesc: 'SceneGraph components that Roku has deprecated.',
  categoryDeprecatedApis: 'Deprecated APIs',
  categoryDeprecatedApisDesc: 'BrightScript APIs that Roku has deprecated.',
  categoryManifest: 'Manifest',
  categoryManifestDesc: "Problems with your channel's manifest file.",
  categoryRaf: 'RAF',
  categoryRafDesc: 'Roku Advertising Framework integration checks.',
  categoryRed: 'RED',
  categoryRedDesc: "Checks in Roku's RED certification category.",
  categoryPackage: 'Package',
  categoryPackageDesc: "How your channel's package (zip) is structured.",

  // Analyze / Cancel + console
  analyzeBtn: 'Analyze',
  cancelBtn: 'Cancel',
  analyzingLabel: 'Analyzing…',
  consoleOutputLabel: 'Console Output',

  // Results
  resultsHeading: 'Results',
  summaryErrors: (n: number): string => `${n} Error${n === 1 ? '' : 's'}`,
  summaryWarnings: (n: number): string => `${n} Warning${n === 1 ? '' : 's'}`,
  summaryInfo: (n: number): string => `${n} Info`,
  tableHeaderSeverity: 'Severity',
  tableHeaderCategory: 'Category',
  tableHeaderMessage: 'Message',
  tableHeaderLocation: 'Location',
  viewJsonBtn: 'View JSON',
  jsonModalTitle: 'Static Analysis Report — JSON',
  saveJsonBtn: 'Save…',
  saveJsonDialogTitle: 'Save Static Analysis Report',
  noReportFallbackNote: "Couldn't find a structured report — showing the tool's raw output instead.",
  malformedReportNote: "The report file couldn't be parsed — showing the tool's raw output instead.",
  noIssuesFound: 'No issues found.',
  expandDetailsTitle: 'Show Details',
  collapseDetailsTitle: 'Hide Details',
  certRequirementsLabel: 'Cert Requirements',
  documentationLabel: 'Documentation',

  // Run outcome
  runCancelled: 'Analysis cancelled.',
  runTimedOut: 'Analysis timed out.',
  runFailed: (message: string): string => `Analysis failed: ${message}`,

  // Error titles — short labels paired with the main process's own detail message
  // (`${errorTitle}: ${detail}`), rather than one bespoke sentence per failure mode.
  errorTitles: {
    'network-unreachable': 'Network Unreachable',
    'cdn-non-200': 'Download Failed',
    'disk-full': 'Not Enough Disk Space',
    'permission-denied': 'Permission Denied',
    'unexpected-archive-layout': 'Unexpected Tool Package',
    'java-not-found': 'Java Not Found',
    'java-check-failed': 'Java Check Failed',
    'java-incompatible': 'Incompatible Java Version',
    'invalid-input-path': 'File Not Found',
    'invalid-input-package': 'Invalid Channel Package',
    'spawn-failed': "Couldn't Start the Analysis Tool",
    'sca-tool-crashed': 'Analysis Tool Crashed',
    timeout: 'Analysis Timed Out',
    cancelled: 'Analysis Cancelled',
    'report-missing': 'No Report Produced',
    'report-malformed': "Report Couldn't Be Read",
    'tool-not-ready': "Analysis Tool Isn't Ready Yet"
  }
} as const;
