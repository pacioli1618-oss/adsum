import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {csvNumber, fileSlug, toCsv} from '../src/lib/csv';

describe('toCsv', () => {
  it('starts with a BOM, uses ; and CRLF', () => {
    assert.equal(toCsv([['Dia', 'Chegada'], ['ter., 3 de nov.', '08:00']]), '﻿Dia;Chegada\r\nter., 3 de nov.;08:00\r\n');
  });
  it('quotes cells with separators, quotes and line breaks', () => {
    assert.equal(toCsv([['a;b', 'diz "oi"', 'linha\nnova']]), '﻿"a;b";"diz ""oi""";"linha\nnova"\r\n');
  });
  it('neutralizes formulas but keeps negative numbers', () => {
    assert.equal(toCsv([['=HYPERLINK("x")', -5, null]]), '﻿"\'=HYPERLINK(""x"")";-5;\r\n');
  });
});

describe('csv helpers', () => {
  it('writes numbers with the reader decimal separator', () => {
    assert.equal(csvNumber(1234.5, 'pt-BR'), '1234,5');
    assert.equal(csvNumber(1234.5, 'en'), '1234.5');
    assert.equal(csvNumber(null, 'pt-BR'), '');
  });
  it('makes file-safe names', () => {
    assert.equal(fileSlug('Padaria São João!'), 'padaria-sao-joao');
    assert.equal(fileSlug('***'), 'adsum');
  });
});
