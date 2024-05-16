/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import { Fragment, h } from 'preact';
import { CliCommandRenderable } from '../entities/renderables';
import { REFERENCE_MEMBERS, REFERENCE_MEMBERS_CONTAINER } from '../styling/css-classes';
import { CliCard } from './cli-card';
import { HeaderCli } from './header-cli';
import { RawHtml } from './raw-html';

/** Component to render a CLI command reference document. */
export function CliCommandReference(entry: CliCommandRenderable) {
  return (
    <div className="cli">
      <div className="docs-reference-cli-content">
        <HeaderCli command={entry} />
        {[entry.name, ...entry.aliases].map((command)  => 
          <div class="docs-code docs-reference-cli-toc">
            <pre class="docs-mini-scroll-track">
              <code>
                <div className={'hljs-ln-line'}>
                  ng {commandName(entry, command)}
                  {entry.argumentsLabel ? <button member-id={'Arguments'} className="hljs-ln-line-argument">{entry.argumentsLabel}</button> : <></>}
                  {entry.hasOptions ? <button member-id={'Options'} className="hljs-ln-line-option">[options]</button> : <></>}
                </div>
              </code>
            </pre>
          </div>
        )}
        <RawHtml value={entry.htmlDescription}/>
        {entry.subcommands && entry.subcommands?.length > 0 ? <>
        <h3>Sub-commands</h3>
        <p>This command has the following sub-commands</p>
        <ul>
          {entry.subcommands.map((subcommand) => 
            <li>
              <a href={`cli/${entry.name}/${subcommand.name}`}>{subcommand.name}</a>
            </li>
          )}  
        </ul>
        </> : <></>}
      </div>
      <div className={REFERENCE_MEMBERS_CONTAINER}>
        <div className={REFERENCE_MEMBERS}>
          {entry.cards.map((card) => <CliCard card={card} />)}
        </div>
      </div>
    </div>
  );
}


function commandName(entry: CliCommandRenderable, command: string) {
  if (entry.parentCommand?.name) {
    return `${entry.parentCommand?.name} ${command}`;
  } else {
    return command;
  }
}