import {CheckRunEvent} from '@octokit/webhooks-types';
import {GithubBaseModel, GithubHelperFunctions} from './base';

interface FirestoreCheck {
  name: string;
  detailsUrl: string | null;
  state: CheckRunEvent['check_run']['conclusion'];
}

export class GithubCheck extends GithubBaseModel<FirestoreCheck> {
  readonly name = this.data.name;
  readonly targetUrl = this.data.detailsUrl;
  readonly status = this.data.state;

  static override githubHelpers: GithubHelperFunctions<CheckRunEvent, FirestoreCheck> = {
    buildRefString(model: CheckRunEvent) {
      return `githubCommit/${model.check_run.head_sha}/check/${model.check_run.name}`;
    },
    fromGithub(model: CheckRunEvent) {
      return {
        name: model.check_run.name,
        detailsUrl: model.check_run.details_url || null,
        state: model.check_run.conclusion,
      };
    },
  };
}
