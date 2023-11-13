import {parseMarkdown} from '../../src/index';
import {runfiles} from '@bazel/runfiles';
import {readFile} from 'fs/promises';
import {JSDOM} from 'jsdom';

describe('markdown to html', () => {
  let markdownDocument: DocumentFragment;

  beforeAll(async () => {
    const markdownContent = await readFile(
      runfiles.resolvePackageRelative('docs-pill/docs-pill.md'),
      {encoding: 'utf-8'},
    );
    markdownDocument = JSDOM.fragment(await parseMarkdown(markdownContent));
  });

  it('should render links to anchors on the same page', () => {
    const samePageEl = markdownDocument.querySelectorAll('a.docs-pill')[0];
    expect(samePageEl.textContent?.trim()).toBe('Same Page');
  });

  it('should render external links with _blank target and iconography', () => {
    const samePageEl = markdownDocument.querySelectorAll('a.docs-pill')[1];
    expect(samePageEl.getAttribute('target')).toBe('_blank');
    expect(samePageEl.textContent?.trim()).toContain('External Page');
    expect(samePageEl.querySelector('docs-icon')?.textContent).toBe('open_in_new');
  });

  it('should render internal links that are relative paths', () => {
    const samePageEl = markdownDocument.querySelectorAll('a.docs-pill')[2];
    expect(samePageEl.textContent?.trim()).toBe('Another Page');
  });
});
