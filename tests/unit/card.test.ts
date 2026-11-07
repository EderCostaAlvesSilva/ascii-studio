import { describe, expect, it } from 'vitest';
import { defaultCardFields, toCardSvg } from '../../src/core/card';
import type { ArtResult, CardField } from '../../src/core/types';

const art: ArtResult = { cols: 3, rows: 2, lines: ['abc', 'def'], colors: null };
const field = (label: string, value: string): CardField => ({ id: label + value, label, value });

describe('defaultCardFields', () => {
  it('começa com os cinco campos previstos, com ids únicos', () => {
    const fields = defaultCardFields();
    expect(fields.map((f) => f.label)).toEqual(['Nome', 'Usuário', 'Linguagens', 'Hobbies', 'Contato']);
    expect(new Set(fields.map((f) => f.id)).size).toBe(5);
  });
});

describe('toCardSvg', () => {
  it('coloca a arte à esquerda e as informações à direita', () => {
    const svg = toCardSvg({ ...art, cols: 40, lines: ['a'.repeat(40), 'b'.repeat(40)] }, [field('Nome', 'Ana')], 'dark');
    const artX = Number(/<text x="(\d+)"[^>]*>a{40}/.exec(svg)![1]);
    const infoX = Number(/<text x="(\d+)"[^>]*><tspan[^>]*>Nome:/.exec(svg)![1]);
    expect(infoX).toBeGreaterThan(artX + 40 * 10);
  });

  it('usa o usuário como título, em estilo neofetch', () => {
    const svg = toCardSvg(art, [field('Nome', 'Ana'), field('Usuário', 'ana_dev')], 'dark');
    expect(svg).toContain('>ana_dev<');
    expect(svg).toContain('-------');
  });

  it('escapa os campos digitados', () => {
    const svg = toCardSvg(art, [field('<script>', '"&</text>')], 'dark');
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).toContain('&quot;&amp;&lt;/text&gt;');
  });

  it('quebra valores longos sem ultrapassar a coluna de informações', () => {
    const long = 'palavra '.repeat(30).trim();
    const svg = toCardSvg(art, [field('Usuário', 'ana'), field('Bio', long), field('Url', 'x'.repeat(200))], 'dark');
    const contents = [...svg.matchAll(/<text[^>]*>(?:<tspan[^>]*>[^<]*<\/tspan>)?([^<]*)<\/text>/g)].map((m) => m[1]!.replace(/\u00a0/g, ' '));
    expect(contents.some((c) => c.includes('palavra'))).toBe(true);
    for (const c of contents) expect(c.length).toBeLessThanOrEqual(48);
    expect(svg.split('palavra').length - 1).toBe(30);
  });

  it('omite campos totalmente vazios e cresce com a quantidade de campos', () => {
    const empty = toCardSvg(art, [field('', '')], 'dark');
    expect(empty).not.toContain('>:<');
    const height = (svg: string) => Number(/height="(\d+)"/.exec(svg)![1]);
    const many = toCardSvg(art, Array.from({ length: 20 }, (_, i) => field(`C${i}`, 'v')), 'dark');
    expect(height(many)).toBeGreaterThan(height(empty));
  });

  it('nunca põe espaço não separável dentro de uma tag, o que invalidaria o SVG', () => {
    const svg = toCardSvg({ ...art, lines: ['a b', 'c d'] }, [field('Nome', 'Ana Souza'), field('Usuário', 'ana dev')], 'dark');
    expect(svg).not.toMatch(/<[^>]*\u00a0[^>]*>/);
    expect(svg).toContain('Ana\u00a0Souza');
  });

  it('muda as cores conforme o tema', () => {
    expect(toCardSvg(art, [], 'light')).toContain('#ffffff');
    expect(toCardSvg(art, [], 'dark')).toContain('#0d1117');
  });
});
