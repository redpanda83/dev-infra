/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {DryRunError, isDryRun} from '../dry-run.js';
import {GithubConfig, assertValidGithubConfig, getConfig} from '../config.js';
import {SpawnSyncOptions, SpawnSyncReturns, spawnSync} from 'child_process';
import {Log} from '../logging.js';

import {GithubClient} from './github.js';
import {getRepositoryGitUrl} from './github-urls.js';
import {determineRepoBaseDirFromCwd} from '../repo-directory.js';

/** Error for failed Git commands. */
export class GitCommandError extends Error {
  // Note: Do not expose the unsanitized arguments as a public property. NodeJS
  // could print the properties of an error instance and leak e.g. a token.
  constructor(client: GitClient, unsanitizedArgs: string[]) {
    // Errors are not guaranteed to be caught. To ensure that we don't
    // accidentally leak the Github token that might be used in a command,
    // we sanitize the command that will be part of the error message.
    super(`Command failed: git ${client.sanitizeConsoleOutput(unsanitizedArgs.join(' '))}`);
  }
}

/** The options available for the `GitClient``run` and `runGraceful` methods. */
type GitCommandRunOptions = SpawnSyncOptions;

/** Class that can be used to perform Git interactions with a given remote. **/
export class GitClient {
  /** Short-hand for accessing the default remote configuration. */
  readonly remoteConfig: GithubConfig;

  /** Octokit request parameters object for targeting the configured remote. */
  readonly remoteParams: {owner: string; repo: string};

  /** Name of the primary branch of the upstream remote. */
  readonly mainBranchName: string;

  /** Instance of the Github client. */
  readonly github = new GithubClient();

  /** The configuration, containing the github specific configuration. */
  readonly config: {github: GithubConfig};

  /**
   * Path to the Git executable. By default, `git` is assumed to exist
   * in the shell environment (using `$PATH`).
   */
  readonly gitBinPath: string = 'git';

  constructor(
    /** The configuration, containing the github specific configuration. */
    config: {github: GithubConfig},
    /** The full path to the root of the repository base. */
    readonly baseDir = determineRepoBaseDirFromCwd(),
  ) {
    this.config = config;
    this.remoteConfig = config.github;
    this.remoteParams = {owner: config.github.owner, repo: config.github.name};
    this.mainBranchName = config.github.mainBranchName;
  }

  /** Executes the given git command. Throws if the command fails. */
  run(args: string[], options?: GitCommandRunOptions): Omit<SpawnSyncReturns<string>, 'status'> {
    const result = this.runGraceful(args, options);
    if (result.status !== 0) {
      throw new GitCommandError(this, args);
    }
    // Omit `status` from the type so that it's obvious that the status is never
    // non-zero as explained in the method description.
    return result as Omit<SpawnSyncReturns<string>, 'status'>;
  }

  /**
   * Spawns a given Git command process. Does not throw if the command fails. Additionally,
   * if there is any stderr output, the output will be printed. This makes it easier to
   * info failed commands.
   */
  runGraceful(args: string[], options: GitCommandRunOptions = {}): SpawnSyncReturns<string> {
    /** The git command to be run. */
    const gitCommand = args[0];

    if (isDryRun() && gitCommand === 'push') {
      Log.debug(`"git push" is not able to be run in dryRun mode.`);
      throw new DryRunError();
    }

    // Clear the credential helper that is used, preventing the temporary token from being saved as a
    // valid token for future use.
    args = ['-c', 'credential.helper=', ...args];
    // To improve the debugging experience in case something fails, we print all executed Git
    // commands at the DEBUG level to better understand the git actions occurring.
    // Note that we sanitize the command before printing it to the console. We do not want to
    // print an access token if it is contained in the command. It's common to share errors with
    // others if the tool failed, and we do not want to leak tokens.
    Log.debug('Executing: git', this.sanitizeConsoleOutput(args.join(' ')));

    const result = spawnSync(this.gitBinPath, args, {
      cwd: this.baseDir,
      stdio: 'pipe',
      ...options,
      // Encoding is always `utf8` and not overridable. This ensures that this method
      // always returns `string` as output instead of buffers.
      encoding: 'utf8',
    });

    Log.debug(`Status: ${result.status}, Error: ${!!result.error}, Signal: ${result.signal}`);

    if (result.status !== 0 && result.stderr !== null) {
      // Git sometimes prints the command if it failed. This means that it could
      // potentially leak the Github token used for accessing the remote. To avoid
      // printing a token, we sanitize the string before printing the stderr output.
      process.stderr.write(this.sanitizeConsoleOutput(result.stderr));
    }

    Log.debug('Stdout:', result.stdout);
    Log.debug('Stderr:', result.stderr);
    Log.debug('Process Error:', result.error);

    if (result.error !== undefined) {
      // Git sometimes prints the command if it failed. This means that it could
      // potentially leak the Github token used for accessing the remote. To avoid
      // printing a token, we sanitize the string before printing the stderr output.
      process.stderr.write(this.sanitizeConsoleOutput(result.error.message));
    }

    return result;
  }

  /** Git URL that resolves to the configured repository. */
  getRepoGitUrl() {
    return getRepositoryGitUrl(this.remoteConfig);
  }

  /** Whether the given branch contains the specified SHA. */
  hasCommit(branchName: string, sha: string): boolean {
    return this.run(['branch', branchName, '--contains', sha]).stdout !== '';
  }

  /** Whether the local repository is configured as shallow. */
  isShallowRepo(): boolean {
    return this.run(['rev-parse', '--is-shallow-repository']).stdout.trim() === 'true';
  }

  /** Gets the currently checked out branch or revision. */
  getCurrentBranchOrRevision(): string {
    const branchName = this.run(['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim();
    // If no branch name could be resolved. i.e. `HEAD` has been returned, then Git
    // is currently in a detached state. In those cases, we just want to return the
    // currently checked out revision/SHA.
    if (branchName === 'HEAD') {
      return this.run(['rev-parse', 'HEAD']).stdout.trim();
    }
    return branchName;
  }

  /** Gets whether the current Git repository has uncommitted changes. */
  hasUncommittedChanges(): boolean {
    // We also need to refresh the index in case some files have been touched
    // but not modified. The diff-index command will not check contents so we
    // manually need to refresh and cleanup the index before performing the diff.
    // Relevant info: https://git-scm.com/docs/git-diff-index#_non_cached_mode,
    // https://git-scm.com/docs/git-update-index and https://stackoverflow.com/a/34808299.
    this.runGraceful(['update-index', '-q', '--refresh']);

    return this.runGraceful(['diff-index', '--quiet', 'HEAD']).status !== 0;
  }

  /**
   * Checks out a requested branch or revision, optionally cleaning the state of the repository
   * before attempting the checking. Returns a boolean indicating whether the branch or revision
   * was cleanly checked out.
   */
  checkout(branchOrRevision: string, cleanState: boolean): boolean {
    if (cleanState) {
      // Abort any outstanding ams.
      this.runGraceful(['am', '--abort'], {stdio: 'ignore'});
      // Abort any outstanding cherry-picks.
      this.runGraceful(['cherry-pick', '--abort'], {stdio: 'ignore'});
      // Abort any outstanding rebases.
      this.runGraceful(['rebase', '--abort'], {stdio: 'ignore'});
      // Clear any changes in the current repo.
      this.runGraceful(['reset', '--hard'], {stdio: 'ignore'});
    }
    return this.runGraceful(['checkout', branchOrRevision], {stdio: 'ignore'}).status === 0;
  }

  /** Retrieve a list of all files in the repository changed since the provided shaOrRef. */
  allChangesFilesSince(shaOrRef = 'HEAD'): string[] {
    return Array.from(
      new Set([
        ...gitOutputAsArray(this.runGraceful(['diff', '--name-only', '--diff-filter=d', shaOrRef])),
        ...gitOutputAsArray(this.runGraceful(['ls-files', '--others', '--exclude-standard'])),
      ]),
    );
  }

  /** Retrieve a list of all files currently staged in the repostitory. */
  allStagedFiles(): string[] {
    return gitOutputAsArray(
      this.runGraceful(['diff', '--name-only', '--diff-filter=ACM', '--staged']),
    );
  }

  /** Retrieve a list of all files tracked in the repository. */
  allFiles(): string[] {
    return gitOutputAsArray(this.runGraceful(['ls-files']));
  }

  /**
   * Sanitizes the given console message. This method can be overridden by
   * derived classes. e.g. to sanitize access tokens from Git commands.
   */
  sanitizeConsoleOutput(value: string) {
    return value;
  }

  /** The singleton instance of the unauthenticated `GitClient`. */
  private static _unauthenticatedInstance: Promise<GitClient> | null = null;

  /**
   * Static method to get the singleton instance of the `GitClient`,
   * creating it, if not created yet.
   */
  static async get(): Promise<GitClient> {
    // If there is no cached instance, create one and cache the promise immediately.
    // This avoids constructing a client twice accidentally when e.g. waiting for the
    // configuration to be loaded.
    if (GitClient._unauthenticatedInstance === null) {
      GitClient._unauthenticatedInstance = (async () => {
        return new GitClient(await getConfig([assertValidGithubConfig]));
      })();
    }

    return GitClient._unauthenticatedInstance;
  }
}

/**
 * Takes the output from `run` and `runGraceful` and returns an array of strings for each
 * new line. Git commands typically return multiple output values for a command a set of
 * strings separated by new lines.
 *
 * Note: This is specifically created as a locally available function for usage as convenience
 * utility within `GitClient`'s methods to create outputs as array.
 */
function gitOutputAsArray(gitCommandResult: SpawnSyncReturns<string>): string[] {
  return gitCommandResult.stdout
    .split('\n')
    .map((x) => x.trim())
    .filter((x) => !!x);
}
