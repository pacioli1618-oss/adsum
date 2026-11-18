import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {buildClientUrl, buildInviteUrl, buildWhatsAppUrl, displayUrl, readTokenFromHash} from '../src/lib/share-links';

describe('share links', () => {
  const origin = 'https://adsum.gr1618.io';
  it('keeps tokens in the fragment', () => {
    assert.equal(buildClientUrl(origin, 'k3v2kw2n', 'secret'), 'https://adsum.gr1618.io/w/k3v2kw2n/manage#secret');
    assert.equal(buildInviteUrl(origin, 'k3v2kw2n', 'abc'), 'https://adsum.gr1618.io/w/k3v2kw2n/invite#abc');
  });
  it('reads tokens back', () => {
    assert.equal(readTokenFromHash('#abc%20'), 'abc');
    assert.equal(readTokenFromHash(''), '');
    assert.equal(readTokenFromHash('#%E0%A4%A'), '');
  });
  it('formats for people and WhatsApp', () => {
    assert.equal(displayUrl('https://adsum.gr1618.io/w/x'), 'adsum.gr1618.io/w/x');
    assert.equal(buildWhatsAppUrl('Olá & tchau'), 'https://wa.me/?text=Ol%C3%A1%20%26%20tchau');
  });
});
