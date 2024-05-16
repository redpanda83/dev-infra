/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

/** Error that will be thrown if the user manually aborted a release action. */
export class UserAbortedReleaseActionError extends Error {}

/** Error that will be thrown if the action has been aborted due to a fatal error. */
export class FatalReleaseActionError extends Error {}
